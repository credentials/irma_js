$(function() {
    // Setup verification request
    var sprequest = {
        "data": "foobar",
        "validity": 60,
        "request": {
            "content": [
                {
                    "label": "over12",
                    "attributes": ["MijnOverheid.ageLower.over12"]
                },
                {
                    "label": "over16",
                    "attributes": ["MijnOverheid.ageLower.over16"]
                }
            ]
        }
    };

    function init() {
        console.log("Init called!");
        var btn = document.getElementById("try_irma_btn")
        var success_fun = function(data) {
            console.log("Authentication successful!");
            console.log("Authentication token:", data);
            $("#result_status").html("Success!");
            $("#token-raw").text(JSON.stringify(data));
            $("#token-content").text(JSON.stringify(jwt_decode(data), null, 2));
        }
        var error_fun = function(data) {
            console.log("Authentication failed!");
            console.log("Error data:", data);
            $("#result_status").html("Failure!");
        }

        btn.addEventListener("click", function() {
            console.log("Button clicked");
            IRMA.authenticate(sprequest, success_fun, error_fun);
        });

        var btn2 = document.getElementById("try_irma_btn2")
        btn2.addEventListener("click", function() {
            console.log("Button clicked");
            IRMA.authenticate_android(sprequest, success_fun, error_fun);
        });
    }

    init();
});
