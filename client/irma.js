// --------- Real future IRMA stuff -----

var verificationServer = "";
const serverPage = "authenticate.html";
var popup;

var state;
const State = {
    Initialized: Symbol(),
    PopupReady: Symbol(),
    Done: Symbol()
}

var verificationRequest;
var successCallback;
var failureCallback;

function info() {
    console.log("VerificationServer:", verificationServer);
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
    }
}

function handleMessage(event) {
    var msg = event.data
    console.log("Received message: ", msg);

    // If server page is ready, the server page
    // was reloaded, reset state machine to Initialized
    if(msg.type === "serverPageReady") {
        state = State.Initialized;
    }

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

// Initialize
getSetupFromMetas();
window.addEventListener('message', handleMessage, false);

export {authenticate, info};
