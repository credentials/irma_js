function handleMessage(event) {
    var msg = event.data;
    console.log("Received message: ", msg);

    switch (msg.type) {
        case "tokenData":
            console.log("Got only a QR code");
            $("#qrcode").qrcode({
                text: JSON.stringify(msg.message),
                size: 128,
            });
            $("#spinner").hide();
            $(".irma_option_container").show();
            break;
        case "clientConnected":
            showMessage("Please follow the instructions on your IRMA token");
            $(".irma_option_container").hide();
            break;
        case "done":
            window.close();
            break;
        default:
            failure("ERROR: unknown message:", msg);
            break;
    }
}

function sendMessage(data){
    window.top.postMessage(data, "*");
    console.log("Sent message: " + JSON.stringify(data));
}

function failure() {
    console.log("ERROR: ", arguments);

    if (arguments.length > 0) {
        $(".irma_title").html("ERROR");
        showMessage("<b>Error: <b> " + arguments[0]);
        $("#irma_text").add_class("error");
    }
}

function showMessage(msg) {
    $("#irma_text").html(msg);
}

$("#help_button").on("click", function() {
    alert("Sorry, no help available yet");
});

$("#cancel_button").on("click", function() {
    sendMessage({
        type: "userCancelled",
    });
    window.close();
});

window.onmessage = handleMessage;
window.addEventListener("message", handleMessage, false);

sendMessage({
    type: "serverPageReady",
});

console.log("Server module loaded");
