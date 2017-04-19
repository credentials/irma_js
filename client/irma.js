var jwt_decode = require('jwt-decode');

var webServer = "";
var popup;

const State = {
    Initialized: Symbol(),
    PopupReady: Symbol(),
    SessionStarted: Symbol(),
    ClientConnected: Symbol(),
    Cancelled: Symbol(),
    Timeout: Symbol(),
    Done: Symbol()
}
var state = State.Done;

// Extra state, this flag is set when we timeout locally but the
// status socket is still active. After this flag is set, we assume
// that errors while polling (if the status socket dies) are due to
// a timeout.
var sessionTimedOut = false;

const StateMap = {
    [State.Initialized]: "Initialized",
    [State.SessionStarted]: "SessionStarted",
    [State.ClientConnected]: "ClientConnected",
    [State.PopupReady]: "PopupReady",
    [State.Cancelled]: "Cancelled",
    [State.Timeout]: "Timeout",
    [State.Done]: "Done"
}

const Action = {
    Verifying: Symbol(),
    Issuing: Symbol(),
    Signing: Symbol()
}

var ua;
const UserAgent = {
    Desktop: Symbol(),
    Android: Symbol(),
}

var sessionPackage;
var sessionRequest;
var sessionCounter = 0;

var successCallback;
var cancelCallback;
var failureCallback;

var sessionData;
var sessionId;
var apiServer;
var action;
var actionPath;

const STATUS_CHECK_INTERVAL = 500;
const DEFAULT_TIMEOUT = 120 * 1000;

var fallbackTimer;
var timeoutTimer;

function info() {
    console.log("VerificationServer:", webServer);
}

function failure(msg, ...data) {
    console.log("ERROR:", msg, ...data);

    state = State.Done;
    closePopup();
    cancelTimers();

    if(typeof(failureCallback) !== "undefined") {
        failureCallback(msg, ...data);
    }
}

function getSetupFromMetas() {
    console.log("Running getSetupFromMetas");
    var metas = document.getElementsByTagName("meta");
    for(var i = 0; i < metas.length; i++) {
        var meta_name = metas[i].getAttribute("name");
        if (meta_name == null) {
            continue;
        }

        meta_name = meta_name.toLowerCase();
        console.log("Examining meta: ", meta_name);
        if(meta_name === "irma-web-server") {
            webServer = metas[i].getAttribute("value");
            console.log("VerificationServer set to", webServer);
        }
        if(meta_name === "irma-api-server") {
            apiServer = metas[i].getAttribute("value");
            console.log("API server set to", apiServer);
        }
    }
}

/* TODO: Incomplete user agent detection */
function detectUserAgent() {
    if( /Android/i.test(navigator.userAgent) ) {
        console.log("Detected Android");
        ua = UserAgent.Android;
    } else {
        console.log("Detected Desktop");
        ua = UserAgent.Desktop;
    }
}

function handleMessage(event) {
    var msg = event.data
    console.log("Received message: ", msg);
    console.log("State", StateMap[state]);

    // If server page is ready, the server page
    // was reloaded, reset state machine to Initialized
    switch(msg.type) {
        case "serverPageReady":
            if (state == State.Done || state == State.Cancelled) {
                console.log("Closing popup");
                closePopup();
                return;
            }

            if (state == State.SessionStarted) {
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
            xhr.open('DELETE', encodeURI( actionPath + sessionId ));
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
        message: sessionPackage
    });
}

function sendMessageToPopup(data) {
    if(typeof(popup) !== "undefined") {
        popup.postMessage(data, "*");
        console.log("Sent message to popup: " + JSON.stringify(data));
    }
}

function issue(jwt, success_cb, cancel_cb, failure_cb) {
    action = Action.Issuing;
    actionPath = apiServer + "issue/";

    doInitialRequest(jwt, 'text/plain', success_cb, cancel_cb, failure_cb);
}


function verify(request, success_cb, cancel_cb, failure_cb) {
    // Also support bare (i.e., non-JWT) service provider requests for backwards compatibility
    // We assume that the user meant to create an unsigned JWT.
    if (typeof request == "object") {
        console.log("WARNING: calling IRMA.verify with a bare service provider request "
            + "is deprecated, you should pass a JWT instead. For now your request will be "
            + "converted to an unsigned JWT, but you should consider doing this yourself "
            + "(e.g. using IRMA.createUnsignedVerificationJWT).");
        var jwt = createUnsignedVerificationJWT(request);
    } else {
        // Assume it is a JWT and let the API server figure out if it is valid
        var jwt = request;
    }

    action = Action.Verifying;
    actionPath = apiServer + "verification/";
    console.log("Action Path set to: ", actionPath);

    doInitialRequest(jwt, 'text/plain', success_cb, cancel_cb, failure_cb);
}

function sign(signatureRequest, success_cb, cancel_cb, failure_cb) {
    action = Action.Signing;
    actionPath = apiServer + "signature/";
    console.log("Action Path set to: ", actionPath);

    doInitialRequest(signatureRequest, 'text/plain', success_cb, cancel_cb, failure_cb);
}

function doInitialRequest(request, contenttype, success_cb, cancel_cb, failure_cb) {
    // Check if there is an old unfinished session going on
    if (state !== State.Cancelled && state !== State.Timeout && state !== State.Done) {
        console.log("Found previously active session, cancelling that one first");
        cancelSession(true);
    }

    state = State.Initialized;
    sessionCounter++;

    sessionPackage = {};
    sessionRequest = request;
    sessionTimedOut = false;

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

    if (ua === UserAgent.Desktop) {
        // Popup code
        console.log("Trying to open popup again");
        var serverPage;
        if (action == Action.Issuing)
            serverPage = "issue.html"
        else if (action == Action.Verifying)
            serverPage = "verify.html";
        else
            serverPage = "sign.html";
        popup = window.open(webServer + serverPage, 'name','height=400,width=400');
        if (window.focus) {
            popup.focus();
        }
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', encodeURI(actionPath));
    xhr.setRequestHeader('Content-Type', contenttype);
    var currentSessionCounter = sessionCounter;
    xhr.onload = function() { handleInitialServerMessage(xhr, currentSessionCounter) };
    xhr.send(request);
};

function handleInitialServerMessage(xhr, scounter) {
    if (scounter != sessionCounter) {
        console.log("Intervering result from old session, ignoring!!!");
        return;
    }

    if (xhr.status === 200) {
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
        sessionPackage = {
            v: sessionData.v,
            vmax: sessionData.vmax,
            u: actionPath + sessionId
        };
        console.log("sessionPackage", sessionPackage);

        setupClientMonitoring();
        setupFallbackMonitoring();
        setupTimeoutMonitoring();
        connectClientToken();

        if (state == State.PopupReady) {
            // Popup was already ready, send session data now
            console.log("Sending delayed popup");
            sendSessionToPopup();
        }
        state = State.SessionStarted;
    } else if (xhr.status !== 200) {
        var msg = "Initial call to server API failed. Returned status of " + xhr.status;
        failure(msg);
    }
}

var statusWebsocket;
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
        if ( state == State.Done || state == State.Cancelled ) {
            clearTimeout(fallbackTimer);
            return;
        }

        if ( typeof(statusWebsocket) === "undefined" ||
             statusWebsocket.readyState !== 1 ) {
            // Status WebSocket is not active, check using polling
            var xhr = new XMLHttpRequest();
            xhr.open('GET', encodeURI(status_url));
            xhr.onload = function () { handleFallbackStatusUpdate (xhr); };
            xhr.send();
        }
    }

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
    }

    var timeout = DEFAULT_TIMEOUT;
    if (sessionRequest.timeout > 0) {
        timeout = sessionRequest.timeout * 1000;
    }

    timeoutTimer = setTimeout(checkTimeoutMonitor, timeout);
}

/*
 * Handle polled status updates. There is no state , so status
 * messages will be repeatedly processed by this function.
 */
function handleFallbackStatusUpdate(xhr) {
    if(xhr.status === 200) {
        // Success
        var data = xhr.responseText;
        switch(data) {
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
                console.log("Got unexpected state in poll: ", data)
                break;
        }
    } else {
        // Ignore all errors when already done
        if ( state == State.Done || state == State.Cancelled ) {
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
    if (typeof(checkTimeoutMonitor) !== "undefined") {
        clearTimeout(checkTimeoutMonitor);
    }
}

function connectClientToken() {
    // This is only for android, the popup for desktop has already been opened
    // so as to not trigger the popup blockers
    // TODO for now only for android client
    if (ua === UserAgent.Android) {
        // Android code
        // TODO: handle URL more nicely
        var newUrl =  "intent://#Intent;package=org.irmacard.cardemu;scheme=cardemu;"
            + "l.timestamp=" + Date.now() + ";"
            + "S.qr=" + encodeURIComponent(JSON.stringify(sessionPackage)) + ";"
            + "S.browser_fallback_url=http%3A%2F%2Fapp.irmacard.org%2Fverify;end"
        window.location.href = newUrl;
    }
}

function receiveStatusMessage(data) {
    var msg = data.data

    if (msg === "CANCELLED") {
        cancelSession();
        return;
    }

    if (msg === "TIMEOUT") {
        console.log("Received status message TIMEOUT, timing out");
        timeoutSession();
        return;
    }

    switch(state) {
        case State.SessionStarted:
            handleStatusMessageSessionStarted(msg);
            break;
        case State.ClientConnected:
            handleStatusMessageClientConnected(msg);
            break;
        default:
            failure("ERROR: unknown current state", StateMap[state]);
            break;
    }
}

function handleStatusMessageSessionStarted(msg) {
    switch(msg) {
        case "CONNECTED":
            if (state === State.SessionStarted) {
                console.log("Client device has connected with the server");
                state = State.ClientConnected;
                sendMessageToPopup({type: "clientConnected"});
            }
            break;
        default:
            failure("unknown status message in Initialized state", msg);
            break;
    }
}

function handleStatusMessageClientConnected(msg) {
    switch(msg) {
        case "DONE":
            console.log("Server returned DONE");

            state = State.Done;
            closePopup();
            closeWebsocket();

            if (action == Action.Verifying)
                finishVerification();
            else if (action == Action.Issuing)
                finishIssuance();
            else if (action == Action.Signing)
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
    xhr.open('GET', encodeURI( actionPath + sessionId + "/getproof"));
    xhr.onload = function () { handleProofMessageFromServer(xhr); };
    xhr.send();
}

function finishSigning() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI( actionPath + sessionId + "/getsignature"));
    xhr.onload = function () { handleProofMessageFromServer(xhr); };
    xhr.send();
}

function closePopup() {
    if (ua !== UserAgent.Android) {
        sendMessageToPopup({type: "done"});
    }
}

function cancelSession(cancelOld=false) {
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
    if(xhr.status === 200) {
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
    res = res.replace(/=+$/, '');

    // Replace non-url characters
    res = res.replace(/\+/g, '-');
    res = res.replace(/\//g, '_');

    return res;
}

function createJWT(request, requesttype, subject, issuer) {
    console.log("Creating unsigned JWT!!!");
    var header = {
        alg: "none",
        typ: "JWT"
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

// Initialize
getSetupFromMetas();
detectUserAgent();
window.addEventListener('message', handleMessage, false);

export {
    sign,
    verify,
    issue,
    info,
    createUnsignedJWT, // just calls createUnsignedIssuanceJWT for backwards compatibility
    createUnsignedIssuanceJWT,
    createUnsignedVerificationJWT,
    createUnsignedSignatureJWT
};
