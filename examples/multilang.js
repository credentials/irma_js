$(function() {
    // Setup verification request
    var sprequest = {
        "data": "foobar",
        "validity": 60,
        "request": {
            "content": [
                {
                    "label": "over12",
                    "attributes": ["irma-demo.MijnOverheid.ageLower.over12"]
                },
                {
                    "label": "name",
                    "attributes": ["irma-demo.MijnOverheid.fullName.firstname"]
                }
            ]
        }
    };

    function init() {
        IRMA.init("<IRMA_API_SERVER>", {lang: $("#change_language_sel").val()});
        
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
        
        $("#change_language_sel").on("change", function() {
            console.log("Changed language to " + this.value);
            IRMA.setLang(this.value);
        });

        btn.addEventListener("click", function() {
            console.log("Button clicked");
            var jwt = IRMA.createUnsignedVerificationJWT(sprequest);
            IRMA.verify(jwt, success_fun, cancel_fun, error_fun);
        });
    }

    init();
});
