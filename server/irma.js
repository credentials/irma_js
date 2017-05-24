$(function() {
    function handleMessage(event) {
        if (event.source !== window.parent) {
            console.warn("Warning: discarding message from other source than caller: ", event);
            return;
        }

        console.log("Received message: ", event);
        var msg = event.data;

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
                console.warn("Received unknown message: \"", msg, "\"");
                break;
        }
    }

    function sendMessage(data) {
        window.parent.postMessage(data, "*");
        console.log("Sent message: ", JSON.stringify(data));
    }

    function showMessage(msg) {
        $("#irma_text").html(msg);
    }

    $("#cancel_button").on("click", function() {
        sendMessage({
            type: "userCancelled",
        });
    });

    window.addEventListener("message", handleMessage, false);

    sendMessage({
        type: "serverPageReady",
    });

    console.log("Server module loaded");
});
