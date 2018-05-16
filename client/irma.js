var jwt_decode = require("jwt-decode");
require("bootstrap");

const STATUS_CHECK_INTERVAL = 500;
const DEFAULT_TIMEOUT = 120 * 1000;

const Action = {
    Verifying: "Verifying",
    Issuing: "Issuing",
    Signing: "Signing",
};

const UserAgent = {
    Desktop: "Desktop",
    Android: "Android",
    iOS: "iOS",
};

const State = {
    Initialized: "Initialized",
    PopupReady: "PopupReady",
    SessionStarted: "SessionStarted",
    ClientConnected: "ClientConnected",
    Cancelled: "Cancelled",
    Timeout: "Timeout",
    Done: "Done",
};
var state = State.Done;

// Extra state, this flag is set when we timeout locally but the
// status socket is still active. After this flag is set, we assume
// that errors while polling (if the status socket dies) are due to
// a timeout.
var sessionTimedOut = false;

// State to manage setup
var librarySetup = false;

var ua;

var webServer = "";

var sessionPackage;
var sessionCounter = 0;

var successCallback;
var cancelCallback;
var failureCallback;

var sessionId;
var apiServer;
var action;
var actionPath;

var statusWebsocket;

var fallbackTimer;
var timeoutTimer;

function info() {
    checkInit();
    console.log("IRMA API server:", apiServer);
}

function failure(msg, ...data) {
    console.error("ERROR:", msg, ...data);

    state = State.Done;
    closePopup();
    cancelTimers();

    if (typeof(failureCallback) !== "undefined") {
        failureCallback(msg, ...data);
    }
}

function getSetupFromMetas() {
    console.log("Running getSetupFromMetas");
    var metas = document.getElementsByTagName("meta");
    for (var i = 0; i < metas.length; i++) {
        var meta_name = metas[i].getAttribute("name");
        if (meta_name === null) {
            continue;
        }

        meta_name = meta_name.toLowerCase();
        console.log("Examining meta: ", meta_name);
        if (meta_name === "irma-web-server") {
            webServer = metas[i].getAttribute("value");
            console.log("VerificationServer set to", webServer);
        }
        if (meta_name === "irma-api-server") {
            apiServer = metas[i].getAttribute("value");
            console.log("API server set to", apiServer);
        }
    }
}

/* TODO: Incomplete user agent detection */
function detectUserAgent() {
    if ( /Android/i.test(navigator.userAgent) ) {
        console.log("Detected Android");
        ua = UserAgent.Android;
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
        console.log("Detected iOS");
        ua = UserAgent.iOS;
    } else {
        console.log("Neither Android nor iOS, assuming desktop");
        ua = UserAgent.Desktop;
    }
}

function handleMessage(event) {
    var msg = event.data;
    console.log("Received message: ", msg);
    console.log("State", state);

    // If server page is ready, the server page
    // was reloaded, reset state machine to Initialized
    switch (msg.type) {
        case "serverPageReady":
            if (state === State.Done || state === State.Cancelled) {
                console.log("Closing popup");
                closePopup();
                return;
            }

            if (state === State.SessionStarted) {
                console.log("Sending session to popup in handleMessage()");
                sendSessionToPopup();
            } else {
                // Apparently session data is slow to come in
                state = State.PopupReady;
            }
            break;
        case "userCancelled":
            cancelSession();

            // Inform the server too
            var xhr = new XMLHttpRequest();
            xhr.open("DELETE", encodeURI( actionPath + sessionId ));
            xhr.onload = function () {};
            xhr.send();

            break;
        default:
            console.log("Didn't expect the following message from the popup", msg);
            break;
    }
}

function sendSessionToPopup() {
    sendMessageToPopup({
        type: "tokenData",
        message: sessionPackage,
    });
}

function sendMessageToPopup(data) {
    if ($("#irma-server-modal iframe").length) {
        console.log("Sending message to popup: " + JSON.stringify(data));
        $("#irma-server-modal iframe")[0].contentWindow.postMessage(data, "*");
    }
}

function doSessionFromQr(qr, success_cb, cancel_cb, failure_cb) {
    clearState();
    showPopup();
    setAndCheckCallbacks(success_cb, cancel_cb, failure_cb);

    actionPath = qr.u.substr(0, qr.u.lastIndexOf("/")) + "/";            // Strip session token
    apiServer = actionPath.substr(0, actionPath.lastIndexOf("/")) + "/"; // Also strip session type (e.g., "issue")
    sessionId = qr.u.substr(qr.u.lastIndexOf("/") + 1, qr.u.length);
    sessionPackage = qr;
    startSession();
}

function issue(jwt, success_cb, cancel_cb, failure_cb) {
    checkInit();

    action = Action.Issuing;
    actionPath = apiServer + "issue/";
    doInitialRequest(jwt, success_cb, cancel_cb, failure_cb);
}

function issueFromQr(qr, success_cb, cancel_cb, failure_cb) {
    checkInit();

    action = Action.Issuing;
    doSessionFromQr(qr, success_cb, cancel_cb, failure_cb);
}

function verify(request, success_cb, cancel_cb, failure_cb) {
    checkInit();

    // Also support bare (i.e., non-JWT) service provider requests for backwards compatibility
    // We assume that the user meant to create an unsigned JWT.
    var jwt;
    if (typeof request === "object") {
        console.log("WARNING: calling IRMA.verify with a bare service provider request "
            + "is deprecated, you should pass a JWT instead. For now your request will be "
            + "converted to an unsigned JWT, but you should consider doing this yourself "
            + "(e.g. using IRMA.createUnsignedVerificationJWT).");
        jwt = createUnsignedVerificationJWT(request);
    } else {
        // Assume it is a JWT and let the API server figure out if it is valid
        jwt = request;
    }

    action = Action.Verifying;
    actionPath = apiServer + "verification/";
    doInitialRequest(jwt, success_cb, cancel_cb, failure_cb);
}

function verifyFromQr(qr, success_cb, cancel_cb, failure_cb) {
    checkInit();

    action = Action.Verifying;
    doSessionFromQr(qr, success_cb, cancel_cb, failure_cb);
}

function sign(signatureRequest, success_cb, cancel_cb, failure_cb) {
    checkInit();

    action = Action.Signing;
    actionPath = apiServer + "signature/";
    doInitialRequest(signatureRequest, success_cb, cancel_cb, failure_cb);
}

function signFromQr(qr, success_cb, cancel_cb, failure_cb) {
    checkInit();

    action = Action.Signing;
    doSessionFromQr(qr, success_cb, cancel_cb, failure_cb);
}

function clearState() {
    // Check if there is an old unfinished session going on
    if (state !== State.Cancelled && state !== State.Timeout && state !== State.Done) {
        console.log("Found previously active session, cancelling that one first");
        cancelSession(true);
    }

    state = State.Initialized;
    sessionCounter++;
    sessionPackage = {};
    sessionTimedOut = false;
}

function setAndCheckCallbacks(success_cb, cancel_cb, failure_cb) {
    successCallback = success_cb;
    cancelCallback = cancel_cb;
    failureCallback = failure_cb;

    // Ensure that all the callbacks are properly bound
    if (typeof(successCallback) !== "function") {
        console.log("WARNING: successCallback is not defined.",
                    "irma.js will not return any results!");
        successCallback = function () {};
    }

    if (typeof(cancelCallback) !== "function") {
        console.log("WARNING: cancelCallback is not defined.",
                    "irma.js will not notify cancel events!");
        cancelCallback = function () {};
    }

    if (typeof(failureCallback) !== "function") {
        console.log("WARNING: failureCallback is not defined.",
                    "irma.js will not notify error events!");
        failureCallback = function () {};
    }
}

function showPopup() {
    if (ua === UserAgent.Desktop) {
        // Popup code
        console.log("Trying to open popup");
        var serverPage;
        if (action === Action.Issuing)
            serverPage = "issue.html";
        else if (action === Action.Verifying)
            serverPage = "verify.html";
        else
            serverPage = "sign.html";

        // Add modal iframe
        $("<div id='irma-server-modal' class='modal fade' tabindex='-1' role='dialog' aria-hidden='true'>"
        + "<div class='modal-dialog'><div class='modal-content'><div class='modal-body'>"
        + "<iframe frameborder='0' allowfullscreen=''></iframe>"
        + "</div></div></div></div>")
            .appendTo("body");

        // Might as well start loading the iframe's content already
        $("#irma-server-modal iframe").attr("src", webServer + serverPage);

        // Remove modal from dom again when it is done
        $("#irma-server-modal").on("hidden.bs.modal", function() {
            $("#irma-server-modal").remove();
        });

        $("#irma-server-modal .modal-content, #irma-server-modal .modal-content div, #irma-server-modal iframe").css({
            "width": "455px",
            "height": "570px",
            "margin": "0",
            "padding": "0",
        });
        $("#irma-server-modal .modal-content").css({
            "margin": "0 auto",
            "border-radius": "0",
        });

        // Show the modal
        $("#irma-server-modal").modal({ backdrop: "static", keyboard: false });
    }
}

function doInitialRequest(request, success_cb, cancel_cb, failure_cb) {
    setAndCheckCallbacks(success_cb, cancel_cb, failure_cb);
    clearState();
    showPopup();

    var xhr = new XMLHttpRequest();
    xhr.open("POST", encodeURI(actionPath));
    xhr.setRequestHeader("Content-Type", "text/plain");
    var currentSessionCounter = sessionCounter;
    xhr.onload = function() { handleInitialServerMessage(xhr, currentSessionCounter); };
    xhr.onerror = function() { failure('Could not do initial request to the API server', xhr.statusText); };
    xhr.send(request);
}

function handleInitialServerMessage(xhr, scounter) {
    if (scounter !== sessionCounter) {
        console.log("Intervering result from old session, ignoring!!!");
        return;
    }

    if (xhr.status !== 200) {
        var msg = "Initial call to server API failed. Returned status of " + xhr.status;
        failure(msg);
        return;
    }

    var sessionData;
    try {
        sessionData = JSON.parse(xhr.responseText);
    } catch (err) {
        failure("Cannot parse server initial message: " + xhr.responseText, err);
        return;
    }

    var sessionVersion = sessionData.v;
    sessionId = sessionData.u;

    if ( typeof(sessionVersion) === "undefined" || typeof(sessionId) === "undefined" ) {
        failure("Field 'u' or 'v' missing in initial server message");
        return;
    }

    console.log("Setting sessionPackage");
    sessionPackage = sessionData;
    sessionPackage.u = actionPath + sessionId;
    console.log("sessionPackage", sessionPackage);

    startSession();
}

function startSession() {
    setupClientMonitoring();
    setupFallbackMonitoring();
    setupTimeoutMonitoring();
    connectClientToken();

    if (state === State.PopupReady) {
        // Popup was already ready, send session data now
        console.log("Sending delayed popup");
        sendSessionToPopup();
    }
    state = State.SessionStarted;
}

function setupClientMonitoring() {
    var url = apiServer.replace(/^http/, "ws") + "status/" + sessionId;
    statusWebsocket = new WebSocket(url);
    statusWebsocket.onmessage = receiveStatusMessage;
}

/*
 * Periodically check if verification has completed when the
 * websocket is not active.
 */
function setupFallbackMonitoring() {
    var status_url = actionPath + sessionId + "/status";

    var checkVerificationStatus = function () {
        if ( state === State.Done || state === State.Cancelled ) {
            clearTimeout(fallbackTimer);
            return;
        }

        if ( typeof(statusWebsocket) === "undefined" ||
             statusWebsocket.readyState !== 1 ) {
            // Status WebSocket is not active, check using polling
            var xhr = new XMLHttpRequest();
            xhr.open("GET", encodeURI(status_url + "?" + Math.random()));
            xhr.onload = function () { handleFallbackStatusUpdate(xhr); };
            xhr.send();
        }
    };

    fallbackTimer = setInterval(checkVerificationStatus, STATUS_CHECK_INTERVAL);
}

/*
 * This function makes sure that just before the
 * session to the server times out, we do a manual
 * timeout if the statusSocket is not connected.
 */
function setupTimeoutMonitoring() {
    console.log("Timeout monitoring started");
    var checkTimeoutMonitor = function () {
        console.log("timeout monitoring fired");
        if ( typeof(statusWebsocket) === "undefined" ||
             statusWebsocket.readyState !== 1 ) {
            // Status WebSocket is not active, manually call timeout
            console.log("Manually timing out");
            timeoutSession();
        } else {
            // We should timeout shortly, setting state reflect this
            sessionTimedOut = true;
        }
    };

    timeoutTimer = setTimeout(checkTimeoutMonitor, DEFAULT_TIMEOUT);
}

/*
 * Handle polled status updates. There is no state , so status
 * messages will be repeatedly processed by this function.
 */
function handleFallbackStatusUpdate(xhr) {
    if (xhr.status === 200) {
        // Success
        var data = xhr.responseText;
        switch (data) {
            case "\"INITIALIZED\"":
                // No need to do anything
                break;
            case "\"CONNECTED\"":
                handleStatusMessageSessionStarted("CONNECTED");
                break;
            case "\"DONE\"":
                handleStatusMessageClientConnected("DONE");
                break;
            case "\"CANCELLED\"":
                cancelSession();
                break;
            default:
                console.log("Got unexpected state in poll: ", data);
                break;
        }
    } else {
        // Ignore all errors when already done
        if ( state === State.Done || state === State.Cancelled ) {
            return;
        }

        // TODO: for now also assume timeout on 400 status code
        if (sessionTimedOut || xhr.status === 400) {
            // When timed-out we can ignore errors.
            console.log("Assuming polling error is due to timeout");
            timeoutSession();
            return;
        }
        failure("Status poll from server failed. Returned status of " + xhr.status, xhr);
    }
}

function cancelTimers () {
    if (typeof(fallbackTimer) !== "undefined") {
        clearTimeout(fallbackTimer);
    }
    if (typeof(timeoutTimer) !== "undefined") {
        clearTimeout(timeoutTimer);
    }
}

function connectClientToken() {
    var url = "qr/json/" + encodeURIComponent(JSON.stringify(sessionPackage));
    if (ua === UserAgent.Android) {
        var intent = "intent://" + url + "#Intent;package=org.irmacard.cardemu;scheme=cardemu;"
            + "l.timestamp=" + Date.now() + ";"
            + "S.qr=" + encodeURIComponent(JSON.stringify(sessionPackage)) + ";"
            + "S.browser_fallback_url=http%3A%2F%2Fapp.irmacard.org%2Fverify;end";
        window.location.href = intent;
    } else if (ua === UserAgent.iOS) {
        window.location.href = "irma://" + url;
    }
}

function receiveStatusMessage(data) {
    var msg = data.data;

    if (msg === "CANCELLED") {
        cancelSession();
        return;
    }

    if (msg === "TIMEOUT") {
        console.log("Received status message TIMEOUT, timing out");
        timeoutSession();
        return;
    }

    switch (state) {
        case State.SessionStarted:
            handleStatusMessageSessionStarted(msg);
            break;
        case State.ClientConnected:
            handleStatusMessageClientConnected(msg);
            break;
        default:
            failure("ERROR: unknown current state", state);
            break;
    }
}

function handleStatusMessageSessionStarted(msg) {
    switch (msg) {
        case "CONNECTED":
            if (state === State.SessionStarted) {
                console.log("Client device has connected with the server");
                state = State.ClientConnected;
                sendMessageToPopup({ type: "clientConnected" });
            }
            break;
        default:
            failure("unknown status message in Initialized state", msg);
            break;
    }
}

function handleStatusMessageClientConnected(msg) {
    switch (msg) {
        case "DONE":
            console.log("Server returned DONE");

            state = State.Done;
            closePopup();
            closeWebsocket();

            if (action === Action.Verifying)
                finishVerification();
            else if (action === Action.Issuing)
                finishIssuance();
            else if (action === Action.Signing)
                finishSigning();
            break;
        default:
            failure("unknown status message in Connected state", msg);
            break;
    }
}

function finishIssuance() {
    cancelTimers();
    successCallback();
}

function finishVerification() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", encodeURI( actionPath + sessionId + "/getproof"));
    xhr.onload = function () { handleProofMessageFromServer(xhr); };
    xhr.send();
}

function finishSigning() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", encodeURI( actionPath + sessionId + "/getsignature"));
    xhr.onload = function () { handleProofMessageFromServer(xhr); };
    xhr.send();
}

function closePopup() {
    if (ua !== UserAgent.Android) {
        console.log("Closing popup");
        $("#irma-server-modal").modal("hide");
    }
}

function cancelSession(cancelOld = false) {
    console.log("Token cancelled authentication", cancelOld);
    state = State.Cancelled;

    cancelTimers();
    if (!cancelOld) {
        closePopup();
        cancelCallback("User cancelled authentication");
    }
}

function closeWebsocket() {
    // Close websocket if it is still open
    if ( typeof(statusWebsocket) === "undefined" ||
         statusWebsocket.readyState === 1 ) {
        statusWebsocket.close();
    }
}

function timeoutSession() {
    console.log("Session timeout");
    state = State.Timeout;

    closeWebsocket();
    closePopup();
    cancelTimers();
    cancelCallback("Session timeout, please try again");
}


function handleProofMessageFromServer(xhr) {
    if (xhr.status === 200) {
        // Success
        var data = xhr.responseText;
        console.log("Proof data: ", data);

        cancelTimers();

        var token = jwt_decode(data);
        if (token.status === "VALID") {
            successCallback(data);
        } else {
            console.log("Server rejected proof: ", token.status);
            failureCallback("Server rejected the proof", data);
        }
    } else {
        // Failure
        failure("Request for proof from server failed. Returned status of " + xhr.status, xhr);
    }
}

function base64url(src) {
    var res = btoa(src);

    // Remove padding characters
    res = res.replace(/=+$/, "");

    // Replace non-url characters
    res = res.replace(/\+/g, "-");
    res = res.replace(/\//g, "_");

    return res;
}

function createJWT(request, requesttype, subject, issuer) {
    checkInit();

    console.log("Creating unsigned JWT!!!");
    var header = {
        alg: "none",
        typ: "JWT",
    };

    var payload = {
        sub: subject,
        iss: issuer,
        iat: Math.floor(Date.now() / 1000),
    };
    payload[requesttype] = request;

    return base64url(JSON.stringify(header)) + "." +
           base64url(JSON.stringify(payload)) + ".";
}

function createUnsignedJWT(iprequest) {
    console.log("WARNING: this function is deprecated and may be removed in later "
        + "versions. Use IRMA.createUnsignedIssuanceJWT instead.");
    return createUnsignedIssuanceJWT(iprequest);
}

function createUnsignedIssuanceJWT(iprequest) {
    return createJWT(iprequest, "iprequest", "issue_request", "testip");
}

function createUnsignedVerificationJWT(sprequest) {
    return createJWT(sprequest, "sprequest", "verification_request", "testsp");
}

function createUnsignedSignatureJWT(absrequest) {
    return createJWT(absrequest, "absrequest", "signature_request", "testsigclient");
}

function init(irmaapiserver, irmawebserver) {
    if (librarySetup) {
        console.log("WARNING: double call to init.");
        return;
    }

    if (irmawebserver === undefined || irmaapiserver === undefined) {
        console.log("WARNING: Fetching api and web server from meta tags is deprecated, and may be removed in future versions.");
        getSetupFromMetas();
    } else {
        webServer = irmawebserver;
        apiServer = irmaapiserver;
    }

    detectUserAgent();
    window.addEventListener("message", handleMessage, false);
    librarySetup = true;
}

function checkInit() {
    if (!librarySetup) {
        console.log("WARNING: No previous call to init, fetching api and web server from meta tags");
        init();
    }
}

export {
    init,
    sign,
    verify,
    issue,
    info,
    signFromQr,
    verifyFromQr,
    issueFromQr,
    createUnsignedJWT, // just calls createUnsignedIssuanceJWT for backwards compatibility
    createUnsignedIssuanceJWT,
    createUnsignedVerificationJWT,
    createUnsignedSignatureJWT,
};
