var verificationServer = "";
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

var ua;
const UserAgent = {
    Desktop: Symbol(),
    Android: Symbol(),
}

var sessionPackage;
var verificationRequest;
var successCallback;
var cancelCallback;
var failureCallback;

var sessionData;
var sessionId;
var server;

const STATUS_CHECK_INTERVAL = 500;
var fallbackTimer;

function info() {
    console.log("VerificationServer:", verificationServer);
}

function failure(msg, ...data) {
    console.log("ERROR:", msg, ...data);

    state = State.DONE;
    cancelTimers();

    if(typeof(failureCallback) !== "undefined") {
        failureCallback(msg, ...data);
    }
}

function getSetupFromMetas() {
    console.log("Running getSetupFromMetas");
    var metas = document.getElementsByTagName("meta");
    for(var i = 0; i < metas.length; i++) {
        var meta_name = metas[i].getAttribute("name").toLowerCase();
        console.log("Examining meta: ", meta_name);
        if(meta_name === "irma-verification-server") {
            verificationServer = metas[i].getAttribute("value");
            console.log("VerificationServer set to", verificationServer);
        }
        if(meta_name === "irma-verification-api") {
            server = metas[i].getAttribute("value");
            console.log("API server set to", server);
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

    // If server page is ready, the server page
    // was reloaded, reset state machine to Initialized
    switch(msg.type) {
        case "serverPageReady":
            sendMessageToPopup({
                type: "tokenData",
                message: sessionPackage
            });
            break;
        case "userCancelled":
            cancelSession();

            // Inform the server too
            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', encodeURI( server + sessionId ));
            xhr.onload = function () {};
            xhr.send();

            break;
        default:
            console.log("Didn't expect the following message from the popup", msg);
            break;
    }
}

function handleMessageInitialized(msg) {
    switch(msg.type) {
        case "serverPageReady":
            sendMessageToPopup({
                type: "verificationRequest",
                message: verificationRequest
            });
            state = State.PopupReady;
            break;
        default:
            alert("Unknown message type: " + msg.type);
            break;
    }
}

function handleMessagePopupReady(msg) {
    switch(msg.type) {
        case "verificationResult":
            if(msg.status === "success") {
                successCallback(msg.message);
            } else {
                failureCallback(msg.message);
            }
            state = State.Done;
            break;
        default:
            alert("Unknown message type: " + msg.type);
            break;
    }
}

function handleMessageDone() {
    console.log("Didn't expect message type " + msg.data.type);
}

function sendMessageToPopup(data) {
    if(typeof(popup) !== "undefined") {
        popup.postMessage(data, "*");
        console.log("Sent message to popup: " + JSON.stringify(data));
    }
}

function authenticate(verReq, success, failure) {
    state = State.Initialized;
    console.log("IRMA starting authentication");
    popup = window.open(verificationServer + serverPage, 'name','height=400,width=640');
    if (window.focus) {
        popup.focus();
    }
    verificationRequest = verReq;
    successCallback = success;
    failureCallback = failure;
};

function authenticate_android(verReq, success_cb, cancel_cb, failure_cb) {
    state = State.Initialized;
    console.log("IRMA starting authentication for android");

    verificationRequest = verReq;
    successCallback = success_cb;
    cancelCallback = cancel_cb;
    failureCallback = failure_cb;

    if (ua === UserAgent.Desktop) {
        // Popup code
        console.log("Showing popup");
        popup = window.open(verificationServer + serverPage, 'name','height=400,width=640');
        if (window.focus) {
            popup.focus();
        }
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', encodeURI(server));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() { handleInitialServerMessage(xhr) };
    xhr.send(JSON.stringify(verificationRequest));
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

        sessionPackage = {
            v: sessionData.v,
            u: server + sessionId
        };

        state = State.VerificationSessionStarted;
        console.log("Set state to VerificationSessionStarted");
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
    var url = server.replace(/^http/, "ws") + "status/" + sessionId;
    console.log("Connecting to websocket at:", url);
    statusWebsocket = new WebSocket(url);
    console.log("Got websocket: ", statusWebsocket);
    statusWebsocket.onmessage = receiveStatusMessage;
}

/*
 * Periodically check if verification has completed when the
 * websocket is not active.
 */
function setupFallbackMonitoring() {
    var checkVerificationStatus = function () {
        if ( state == State.Done || state == State.Cancelled ) {
            clearTimeout(fallbackTimer);
            return;
        }

        if ( typeof(statusWebsocket) === "undefined" ||
             statusWebsocket.readyState !== 1 ) {
            // Status WebSocket is not active, check using polling
            var xhr = new XMLHttpRequest();
            xhr.open('GET', encodeURI( server + sessionId + "/status"));
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
            case "\"DONE\"":
                handleStatusMessageClientConnected("DONE");
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
    console.log("STATUS: ", data);
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
                console.log("Set state to ClientConnected");
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
            console.log("Proof is done");
            state = State.Done;
            finishVerification();
            break;
        default:
            failure("unknown status message in Connected state", msg);
            break;
    }
}

function finishVerification() {
    console.log("Verification completed, retrieving token");

    closePopup();

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI( server + sessionId + "/getproof"));
    xhr.onload = function () { handleProofMessageFromServer(xhr); };
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

// Initialize
getSetupFromMetas();
detectUserAgent();
window.addEventListener('message', handleMessage, false);

export {authenticate, authenticate_android, info};
