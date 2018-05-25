var jwt_decode = require("jwt-decode");
require("bootstrap");
var kjua = require("kjua");

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

const ErrorCodes = {
    ConnectionError: {
        Initial: "CONNERR_INITIAL",
        Status: "CONNERR_STATUS",
        Proof: "CONNERR_PROOF",
    },
    ProtocolError: {
        Initial: "PROTERR_INITIAL",
        Sessiondata: "PROTERR_SESSIONDATA",
        Status: {
            Initial: "PROTERR_STATUS_INITIAL",
            Connected: "PROTERR_STATUS_CONNECTED",
        },
    },
    InternalError: {
        State: "INTERR_STATE",
    },
    Cancelled: "CANCELLED",
    Timeout: "TIMEOUT",
    Rejected: "REJECTED"
}

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

const PopupStrings = {
    Sign: {
        Title: 'signing',
        Body: 'A website requested that you sign a message using some IRMA attributes. Please scan the QR code with your phone.'
    },
    Verify: {
        Title: 'showing attribute(s)',
        Body: 'A website requested that you disclose some IRMA attributes. Please scan the QR code with your phone.'
    },
    Issue: {
        Title: 'issuing attribute(s)',
        Body: 'A website wants to issue some IRMA attributes to you. Please scan the QR code with your phone to continue.'
    }
};

// Data for irma logo
const IrmaLogo = "data:image/png;base64,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"

// Extra state, this flag is set when we timeout locally but the
// status socket is still active. After this flag is set, we assume
// that errors while polling (if the status socket dies) are due to
// a timeout.
var sessionTimedOut = false;

// State to manage setup
var librarySetup = false;

var ua;

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

function failure(errorcode, msg, ...data) {
    console.error("ERROR:", errorcode, msg, ...data);

    state = State.Done;
    closePopup();
    cancelTimers();

    if (typeof(failureCallback) !== "undefined") {
        failureCallback(errorcode, msg, ...data);
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

function userCancelled(){
    cancelSession();
    
    var xhr = new XMLHttpRequest();
        xhr.open("DELETE", encodeURI( actionPath + sessionId ));
        xhr.onload = function () {};
        xhr.send();
}

function sendSessionToPopup() {
    $("#irma-qrcode").empty().append(kjua({
        text: JSON.stringify(sessionPackage),
        size: 230,
    }));
    $("#irma-spinner").hide();
    $(".irma_option_container").show();
}

function showMessageOnPopup(msg) {
    $("#irma_text").text(msg);
    $(".irma_option_container").hide();
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
            serverPage = PopupStrings.Issue;
        else if (action === Action.Verifying)
            serverPage = PopupStrings.Verify;
        else
            serverPage = PopupStrings.Sign;

        console.log("serverPage: ", serverPage);

        // Add modal
        $("<div id='irma-server-modal' class='modal fade' tabindex='-1' role='dialog' aria-hidden='true'>"
        + "<div class='modal-dialog'><div class='modal-content'><div class='modal-body'>"
        + "<div class='irma_page'>"
        + "<div class='irma_content'>"
        + "<img src='"+IrmaLogo+"' class='irma_logo_top' alt='IRMA logo'></img>"
        + "<div class='irma_title'></div>"
        + "<p id='irma_text'></p>"
        + "<div id='irma-spinner' class='irma-load6'>"
        + "<div class='irma-loader'>Waiting for data...</div>"
        + "</div>"
        + "<div class='irma_option_container' style='display:none;'>"
        + "<div id='irma-qrcode' class='irma_option_box'></div>"
        + "</div>"
        + "</div>"
        + "<div class='irma_button_box'>"
        + "<button class='irma_button' id='irma-cancel_button'>Cancel</button>"
        + "</div>"
        + "</div>"
        + "</div></div></div></div>")
            .appendTo("body");
        
        // Write informational text
        $("#irma-server-modal .irma_title").text(serverPage.Title);
        $("#irma-server-modal #irma_text").text(serverPage.Body);
        
        // Bind cancel action
        $("#irma-cancel_button").on("click", userCancelled);

        // Remove modal from dom again when it is done
        $("#irma-server-modal").on("hidden.bs.modal", function() {
            $("#irma-server-modal").remove();
        });

        $("#irma-server-modal .modal-content").css({
            "width": "455px",
            "height": "570px",
            "margin": "0",
            "padding": "0",
        });
        $("#irma-server-modal .modal-content .modal-body").css({
            "padding": "8",
        })
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
    xhr.onerror = function() { failure(ErrorCodes.ConnectionError.Initial, 'Could not do initial request to the API server', xhr.statusText); };
    xhr.send(request);
}

function handleInitialServerMessage(xhr, scounter) {
    if (scounter !== sessionCounter) {
        console.log("Intervering result from old session, ignoring!!!");
        return;
    }

    if (xhr.status !== 200) {
        var msg = "Initial call to server API failed. Returned status of " + xhr.status;
        failure(ErrorCodes.ConnectionError.Initial, msg);
        return;
    }

    var sessionData;
    try {
        sessionData = JSON.parse(xhr.responseText);
    } catch (err) {
        failure(ErrorCodes.ProtocolError.Initial, "Cannot parse server initial message: " + xhr.responseText, err);
        return;
    }

    var sessionVersion = sessionData.v;
    sessionId = sessionData.u;

    if ( typeof(sessionVersion) === "undefined" || typeof(sessionId) === "undefined" ) {
        failure(ErrorCodes.ProtocolError.Sessiondata, "Field 'u' or 'v' missing in initial server message");
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

    sendSessionToPopup();
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
        failure(ErrorCodes.ConnectionError.Status, "Status poll from server failed. Returned status of " + xhr.status, xhr);
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
            failure(ErrorCodes.InternalError.State, "ERROR: unknown current state", state);
            break;
    }
}

function handleStatusMessageSessionStarted(msg) {
    switch (msg) {
        case "CONNECTED":
            if (state === State.SessionStarted) {
                console.log("Client device has connected with the server");
                state = State.ClientConnected;
                showMessageOnPopup("Please follow the instructions on your IRMA token");
            }
            break;
        default:
            failure(ErrorCodes.ProtocolError.Status.Initial, "unknown status message in Initialized state", msg);
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
            failure(ErrorCodes.ProtocolError.Status.Connected, "unknown status message in Connected state", msg);
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
        cancelCallback(ErrorCodes.Cancelled, "User cancelled authentication");
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
    cancelCallback(ErrorCodes.Timeout, "Session timeout, please try again");
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
            failureCallback(ErrorCodes.Rejected, "Server rejected the proof", data);
        }
    } else {
        // Failure
        failure(ErrorCodes.ConnectionError.Proof, "Request for proof from server failed. Returned status of " + xhr.status, xhr);
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

function init(irmaapiserver) {
    if (librarySetup) {
        console.log("WARNING: double call to init.");
        return;
    }

    if (irmaapiserver === undefined) {
        console.log("WARNING: Fetching api server from meta tags is deprecated, and may be removed in future versions.");
        getSetupFromMetas();
    } else {
        apiServer = irmaapiserver;
    }

    detectUserAgent();
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
    ErrorCodes,
};
