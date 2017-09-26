function handleMessage(event) {
    var msg = event.data;
    console.log("Received message: ", msg);

    switch (msg.type) {
        case "tokenData":
            console.log("Got a QR code");
            $("#qrcode").empty().qrcode({
                text: JSON.stringify(msg.message),
                size: 230,
            });
            $("#spinner").hide();
            $(".irma_option_container").show();
            break;
        case "clientConnected":
            showMessage("Please follow the instructions on your IRMA token");
            $(".irma_option_container").hide();
            break;
        case "done":
            break;
        default:
            failure("Received unknown message: \"" + msg + "\"");
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

window.addEventListener("message", handleMessage, false);

sendMessage({
    type: "serverPageReady",
});

$(function () {
    $("#cancel_button").on("click", function() {
        sendMessage({
            type: "userCancelled",
        });
    });
});

console.log("Server module loaded");
