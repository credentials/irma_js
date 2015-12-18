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
        }
        var error_fun = function(data) {
            console.log("Authentication failed!");
            console.log("Error data:", data);
        }

        btn.addEventListener("click", function() {
            console.log("Button clicked");
            IRMA.authenticate(sprequest, success_fun, error_fun);
        });
    }

    init();
});
