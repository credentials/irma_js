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
        var cancel_fun = function(data) {
            console.log("Authentication cancelled!");
            $("#result_status").html("Cancelled!");
        }
        var error_fun = function(data) {
            console.log("Authentication failed!");
            console.log("Error data:", data);
            $("#result_status").html("Failure!");
        }

        btn.addEventListener("click", function() {
            console.log("Button clicked");
            IRMA.verify(sprequest, success_fun, error_fun);
        });
    }

    init();
});
