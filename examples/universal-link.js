function success(data) {
    $("#result_status").html("Success!");
    $("#token-raw").text(JSON.stringify(data));
    $("#token-content").text(JSON.stringify(jwt_decode(data), null, 2));
}

function cancel() {
    console.log("Cancelled", arguments);
    $("#result_status").html("Cancelled!");
}

function error() {
    console.log("Error:", arguments);
    $("#result_status").html("Failure!");
}

// Normally this is a function in a backend reachable at some URL,
// instead of in the frontend like here. This function starts the session at the irma_api_server
// by creating a JWT and posting it to the irma_api_server, returning the session pointer
// (i.e. QR contents), e.g.
// {"u":"<IRMA_API_SERVER>/V85GvntC4WAmJavl9Tj2IoHNje8ZMZqIkRxm0IPAH8","v":"2.0","vmax":"2.4","irmaqr":"disclosing"}
function getSessionPtr(success) {
    var jwt = IRMA.createUnsignedVerificationJWT({
        "request": {
            "content": [
                {
                    "label": "over12",
                    "attributes": ["irma-demo.MijnOverheid.ageLower.over12"],
                },
                {
                    "label": "name",
                    "attributes": ["irma-demo.MijnOverheid.fullName.firstname"],
                },
            ],
        },
    });
    $.post({
        url: "<IRMA_API_SERVER>/verification",
        data: jwt,
        contentType: "text/plain",
        success: function(sessionPtr) {
            sessionPtr.u = "<IRMA_API_SERVER>/verification/" + sessionPtr.u;
            success(sessionPtr);
        },
    });
}

$(function() {
    IRMA.init("<IRMA_API_SERVER>");

    if (IRMA.userAgent !== IRMA.UserAgents.iOS) {
        // Handle desktop and Android users normally
        // On Android, after a mobile session the IRMA app programmatically presses the Android 'back' button,
        // going back to the browser tab that started the IRMA session.
        $("a#try_irma_btn").click(function(e) {
            e.preventDefault();
            getSessionPtr(function(sessionPtr) {
                IRMA.verifyFromQr(sessionPtr, success, cancel, error);
            });
        });
    } else {
        /* The flow is as follows:
            (1) User lands on page. A session is started at the apiserver, the UL link is created and embedded
                in the button, and the QR contents is stored in a cookie.
            (2) The user clicks on the UL, navigates away from us to her IRMA app, and does the session
            (3) The user comes back to us through the returnURL parameter, causing a new page load.
                We check if a cookie is set, which it is. We retrieve the QR contents from it, delete it, and resume
                the session. We are informed of its status using the usual success/cancel/error callbacks.
        */

        // (1)
        getSessionPtr(function(sessionPtr) {
            sessionPtr.returnURL = window.location.href;
            console.log("Encoding universal link", sessionPtr);
            $("a#try_irma_btn").attr("href", "https://irma.app/-/session#" + encodeURIComponent(JSON.stringify(sessionPtr)));
            $( ".result" ).html(sessionPtr);
            document.cookie = "sessionPtr=" + JSON.stringify(sessionPtr);
        });

        // https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie#Example_2_Get_a_sample_cookie_named_test2
        var cookieValue = document.cookie.replace(/(?:(?:^|.*;\s*)sessionPtr\s*\=\s*([^;]*).*$)|^.*$/, "$1");
        if (cookieValue) {
            // (3): We have a cookie, the session is already started. Unset cookie and resume/end session.
            document.cookie = "sessionPtr=; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
            // Indicate with false that we don't want to switch to the IRMA app but just finish the session
            IRMA.verifyFromQr(JSON.parse(cookieValue), success, cancel, error, false);
        }
    }
});
