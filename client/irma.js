var webServer = "";
const serverPage = "authenticate.html";
var popup;

var state;
const State = {
    Initialized: Symbol(),
    VerificationSessionStarted: Symbol(),
    ClientConnected: Symbol(),
    PopupReady: Symbol(),
    Cancelled: Symbol(),
    Done: Symbol()
}

const StateMap = {
    [State.Initialized]: "Initialized",
    [State.VerificationSessionStarted]: "VSS",
    [State.ClientConnected]: "ClientConnected",
    [State.PopupReady]: "PopupReady",
    [State.Cancelled]: "Cancelled",
    [State.Done]: "Done"
}

const Action = {
    Verifying: Symbol(),
    Issuing: Symbol()
}

var ua;
const UserAgent = {
    Desktop: Symbol(),
    Android: Symbol(),
}

var sessionPackage;
var successCallback;
var cancelCallback;
var failureCallback;

var sessionData;
var sessionId;
var apiServer;
var action;
var actionPath;

const STATUS_CHECK_INTERVAL = 500;
var fallbackTimer;

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
            sendMessageToPopup({
                type: "tokenData",
                message: sessionPackage
            });
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


function verify(verificationRequest, success_cb, cancel_cb, failure_cb) {
    action = Action.Verifying;
    actionPath = apiServer + "verification/";
    console.log("Action Path set to: ", actionPath);

    doInitialRequest(JSON.stringify(verificationRequest), 'application/json',
            success_cb, cancel_cb, failure_cb);
}

function doInitialRequest(request, contenttype, success_cb, cancel_cb, failure_cb) {
    state = State.Initialized;

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
        popup = window.open(webServer + serverPage, 'name','height=400,width=640');
        if (window.focus) {
            popup.focus();
        }
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', encodeURI(actionPath));
    xhr.setRequestHeader('Content-Type', contenttype);
    xhr.onload = function() { handleInitialServerMessage(xhr) };
    xhr.send(request);
};

function handleInitialServerMessage(xhr) {
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
            u: actionPath + sessionId
        };
        console.log("sessionPackage", sessionPackage);

        state = State.VerificationSessionStarted;
        setupClientMonitoring();
        setupFallbackMonitoring();
        connectClientToken();
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
 * Handle polled status updates. There is no state , so status
 * messages will be repeatedly processed by this function.
 */
function handleFallbackStatusUpdate(xhr) {
    if(xhr.status === 200) {
        // Success
        var data = xhr.responseText;
        switch(data) {
            case "\"CONNECTED\"":
                handleStatusMessageVerificationSessionStarted("CONNECTED");
                break;
            case "\"SUCCESS\"":
                handleStatusMessageClientConnected("SUCCESS");
                break;
            case "\"CANCELLED\"":
                cancelSession();
                break;
            case "\"FAILED\"":
                handleStatusMessageClientConnected("FAILED");
                break;
            default:
                break;
        }
    } else {
        failure("Status poll from server failed. Returned status of " + xhr.status, xhr);
    }
}

function cancelTimers () {
    if (typeof(fallbackTimer) !== "undefined") {
        clearTimeout(fallbackTimer);
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

    switch(state) {
        case State.VerificationSessionStarted:
            handleStatusMessageVerificationSessionStarted(msg);
            break;
        case State.ClientConnected:
            handleStatusMessageClientConnected(msg);
            break;
        default:
            failure("ERROR: unknown current state", state);
            break;
    }
}

function handleStatusMessageVerificationSessionStarted(msg) {
    switch(msg) {
        case "CONNECTED":
            if (state === State.VerificationSessionStarted) {
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
        case "SUCCESS":
            console.log("Everyting successful");
            state = State.Done;
            if (action == Action.Verifying)
                finishVerification();
            else if (action == Action.Issuing)
                finishIssuance();
            break;
        case "FAILED":
            console.log("Proof failed");
            state = State.Done;
            if (action == Action.Verifying)
                finishFailedVerification();
            else if (action == Action.Issuing)
                finishFailedIssuance();
            break;
        default:
            failure("unknown status message in Connected state", msg);
            break;
    }
}

function finishIssuance() {
    closePopup();
    successCallback();
}

function finishFailedIssuance() {
    closePopup();
    failureCallback("Issuance failed");
}

function finishVerification() {
    closePopup();

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI( actionPath + sessionId + "/getproof"));
    xhr.onload = function () { handleProofMessageFromServer(xhr); };
    xhr.send();
}

function finishFailedVerification() {
    closePopup();

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI( actionPath + sessionId + "/getunsignedproof"));
    xhr.onload = function () { handleFailedProofFromServer(xhr); };
    xhr.send();
}

function closePopup() {
    if (ua !== UserAgent.Android) {
        sendMessageToPopup({type: "done"});
    }
}

function cancelSession() {
    console.log("Token cancelled authentication");
    state = State.Cancelled;

    closePopup();
    cancelTimers();
    cancelCallback("User cancelled authentication");
}

function handleProofMessageFromServer(xhr) {
    if(xhr.status === 200) {
        // Success
        var data = xhr.responseText;
        console.log("Proof data: ", data);

        cancelTimers();
        successCallback(data);
    } else {
        // Failure
        failure("Request for proof from server failed. Returned status of " + xhr.status, xhr);
    }
}

function handleFailedProofFromServer(xhr) {
    if(xhr.status === 200) {
        // Success
        var data = xhr.responseText;
        console.log("Failed proof data: ", data);

        cancelTimers();
        failureCallback("Server rejected the proof", data);
    } else {
        // Failure
        failure("Request for unsigned proof from server failed. Returned status of " + xhr.status, xhr);
    }
}

function createJwt(privatekey, isReq) {
    if (privatekey != null) {
        var prvKey = KEYUTIL.getKey(privatekey);
        var alg = "RS256";
    } else {
        var prvKey = null;
        var alg = "none";
    }

    var header = JSON.stringify({alg: alg, typ: "JWT"});
    var payload = {sub: "issue_request", iss: "testip", iat: Math.floor(Date.now() / 1000)};
    $.extend(payload, {"iprequest": isReq});

    return KJUR.jws.JWS.sign(alg, header, payload, prvKey);
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

function createUnsignedJWT(iprequest) {
    console.log("Creating unsigned JWT!!!");
    var header = {
        alg: "none",
        typ: "JWT"
    };

    var payload = {
        sub: "issue_request",
        iss: "testip",
        iat: Math.floor(Date.now() / 1000),
        "iprequest": iprequest
    };

    return base64url(JSON.stringify(header)) + "." +
           base64url(JSON.stringify(payload)) + ".";
}


// Initialize
getSetupFromMetas();
detectUserAgent();
window.addEventListener('message', handleMessage, false);

export {verify, issue, info, createUnsignedJWT};
