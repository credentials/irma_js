var verificationServer = "";
const serverPage = "authenticate.html";
var popup;

var state;
const State = {
    Initialized: Symbol(),
    VerificationSessionStarted: Symbol(),
    ClientConnected: Symbol(),
    PopupReady: Symbol(),
    Done: Symbol()
}

var sessionPackage;
var verificationRequest;
var successCallback;
var failureCallback;

var sessionData;
var sessionId;
var server;

function info() {
    console.log("VerificationServer:", verificationServer);
}

function failure(msg, ...data) {
    console.log("ERROR:", msg, ...data);
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

function handleMessage(event) {
    var msg = event.data
    console.log("Received message: ", msg);

    // If server page is ready, the server page
    // was reloaded, reset state machine to Initialized
    if(msg.type === "serverPageReady") {
        //state = State.Initialized;

        sendMessageToPopup({
            type: "tokenData",
            message: sessionPackage
        });
    }

    // TODO what are we doing with all this?
    return;

    switch(state) {
        case State.Initialized:
            handleMessageInitialized(msg);
            break;
        case State.PopupReady:
            handleMessagePopupReady(msg);
            break;
        case State.Done:
            console.log("Didn't expect a server message in state done");
            break;
        default:
            console.log("Unknown state");
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
    popup.postMessage(data, "*");
    console.log("Sent message to popup: " + JSON.stringify(data));
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

function authenticate_android(verReq, success_cb, failure_cb) {
    state = State.Initialized;
    console.log("IRMA starting authentication for android");

    verificationRequest = verReq;
    successCallback = success_cb;
    failureCallback = failure_cb;

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
        connectClientToken();
    } else if (xhr.status !== 200) {
        var msg = "Initial call to server API failed. Returned status of " + xhr.status;
        failure(msg);
    }
}

function setupClientMonitoring(data) {
    var url = server.replace(/^http/, "ws") + "status/" + sessionId;
    console.log("Connecting to websocket at:", url);
    var ws = new WebSocket(url);
    console.log("Got websocket: ", ws);
    ws.onmessage = receiveStatusMessage;
}

function connectClientToken() {
    // This is only for android, the popup for desktop has already been opened
    // so as to not trigger the popup blockers
    if (ua === UserAgent.Android) {
        // Android code
        // TODO: handle URL more nicely
        var newUrl =  "http://app.irmacard.org/verify#" +
                encodeURIComponent(JSON.stringify(sessionPackage));
        alert("Setting new location to: " + newUrl);
    } else {
        // Popup code
        console.log("Showing popup");
        popup = window.open(verificationServer + serverPage, 'name','height=400,width=640');
        if (window.focus) {
            popup.focus();
        }
    }
}

function receiveStatusMessage(data) {
    console.log("STATUS: ", data);
    var msg = data.data
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
            console.log("Client device has connected with the server");
            state = State.ClientConnected;
            console.log("Set state to ClientConnected");
            sendMessageToPopup({type: "clientConnected"});
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
            failure("unknown status message in Connected state");
            break;
    }
}

function finishVerification() {
    console.log("Verification completed, retrieving token");

    sendMessageToPopup({type: "done"});

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI( server + sessionId + "/getproof"));
    xhr.onload = function () { handleProofMessageFromServer(xhr); };
    xhr.send();
}

function handleProofMessageFromServer(xhr) {
    if(xhr.status === 200) {
        // Success
        var data = xhr.responseText;
        console.log("Proof data: ", data);
        successCallback(data);
    } else {
        // Failure
        failure("Request for proof from server failed. Returned status of " + xhr.status, xhr);
    }
}


// Initialize
getSetupFromMetas();
window.addEventListener('message', handleMessage, false);

export {authenticate, authenticate_android, info};
