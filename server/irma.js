const State = {
    Initialized: Symbol(),
    Connected: Symbol(),
    Done: Symbol(),
}

var state = State.Initialized;
var verificationRequest;
var server;
var ws;
var sessionId;

function getSetupFromMetas() {
    console.log("Running getSetupFromMetas");
    var metas = document.getElementsByTagName("meta");
    for(var i = 0; i < metas.length; i++) {
        var meta_name = metas[i].getAttribute("name").toLowerCase();
        console.log("Examining meta: ", meta_name);
        if(meta_name === "irma-verification-api") {
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
        case State.Connected:
            console.log("Handling message in connected state");
            console.log("ERROR: didn't expect any message in Connected state");
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

    $.ajax(server, {
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify(verificationRequest),
    }).done( function(data, status, request) {
        console.log("Session Data:", data);
        sessionId = data.u;
        showQRCode(data);
        setupStatusChannel(data);
    }).fail( function(data, status, request) {
        failure("The request to the verification server failed", data, status);
    });
}

function finishVerification() {
    console.log("Verification completed, retrieving token");

    $.ajax(server + sessionId + "/getproof", {
        contentType: "application/json",
    }).done( function(data, status, request) {
        console.log("Proof data:", data);
        showMessage("Verification finished");
        sendSuccess(data);
        window.close();
    }).fail( function(data, status, request) {
        failure("Failed to get proof from server", data, status);
    });
}

function showQRCode(data) {
    var qrcontents = {
        v: data.v,
        u: server + sessionId
    }

    $("#qrcode").qrcode({
        text: JSON.stringify(qrcontents),
        size: 128,
    });
}

function setupStatusChannel(data) {
    var url = server.replace(/^http/, "ws") + "status/" + data.u;
    ws = new WebSocket(url);
    console.log("Got websocket: ", ws);
    ws.onmessage = receiveStatusMessage;
}

function receiveStatusMessage(data) {
    console.log("STATUS: ", data);
    var msg = data.data
    switch(state) {
        case State.Initialized:
            handleStatusMessageInitialized(msg);
            break;
        case State.Connected:
            handleStatusMessageConnected(msg);
            break;
        default:
            failure("ERROR: unknown current state", state);
            break;
    }
}

function handleStatusMessageInitialized(msg) {
    switch(msg) {
        case "CONNECTED":
            console.log("Client device has connected with the server");
            showMessage("Please complete the verification on your IRMA token");
            $(".irma_option_container").hide();
            state = State.Connected;
            break;
        default:
            failure("unknown status message in Initialized state", msg);
            break;
    }
}

function handleStatusMessageConnected(msg) {
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

function sendMessage(data){
    window.opener.postMessage(data, "*");
    console.log("Sent message: " + JSON.stringify(data));
}

function sendSuccess(token) {
    var data = {
        type: "verificationResult",
        status: "success",
        message: token,
    };
    sendMessage(data);
}

function sendError() {
    var data = {
        type: "verificationResult",
        status: "error",
        message: "Authentication denied"
    }
    sendMessage(data);
}

function failure() {
    console.log("ERROR: ", arguments);

    if(arguments.length > 0) {
        $(".irma_title").html("ERROR");
        showMessage("<b>Error: <b> " + arguments[0]);
        $("#irma_text").add_class("error");
    }
}

function showMessage(msg) {
    $("#irma_text").html(msg);
}

getSetupFromMetas();
window.addEventListener('message', handleMessage, false);
sendMessage({
    type: "serverPageReady"
});

console.log("Server module loaded");
