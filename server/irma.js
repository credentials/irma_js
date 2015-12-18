const State = {
    Initialized: Symbol(),
}
var state = State.Initialized;
var verificationRequest;
var server;

function getSetupFromMetas() {
    console.log("Running getSetupFromMetas");
    var metas = document.getElementsByTagName("meta");
    for(var i = 0; i < metas.length; i++) {
        var meta_name = metas[i].getAttribute("name").toLowerCase();
        console.log("Examining meta: ", meta_name);
        if(meta_name === "verification-api-server") {
            server = metas[i].getAttribute("value");
            console.log("API server set to", server);
        }
    }
}

function handleMessage(event) {
    var msg = event.data
    console.log("Received message: ", msg);
    switch(state) {
        case State.Initialized:
            console.log("Handling message in initialized state");
            handleMessageInitialized(msg);
            break;
        default:
            console.log("Unknown state");
            break;
    }
}

function handleMessageInitialized(msg) {
    console.log("Initialized state handler", msg);
    switch(msg.type) {
        case "verificationRequest":
            console.log("Starting verification");
            verificationRequest = msg.message;
            startVerification();
            break;
        default:
            console.log("Default handler called, type was", msg.type);
            break;
    }
}

function startVerification() {
    console.log("Verification started: ", verificationRequest);

    $.ajax( server, {
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify(verificationRequest),
        success: successfct,
    });
}

function successfct(data, status, request) {
    console.log("Received verification data from the server, yay");
    console.log("Server data:", data);

    var qrcontents = {
        v: "1.0",
        u: server + data
    }

    $("#qrcode").qrcode({
        text: JSON.stringify(qrcontents),
        size: 128,
    });
}

function sendMessage(data){
    window.opener.postMessage(data, "*");
    console.log("Sent message: " + JSON.stringify(data));
}

function sendSuccess() {
    var data = {
        status: "success",
        message: document.getElementById("msg").value
    };
    sendMessage(data);
}

function sendError() {
    var data = {
        status: "error",
        message: "Authentication denied"
    }
    sendMessage(data);
}

getSetupFromMetas();
window.addEventListener('message', handleMessage, false);
sendMessage({
    type: "serverPageReady"
});

console.log("Server module loaded");
