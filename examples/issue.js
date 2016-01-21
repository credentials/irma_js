var iprequest = {
    data: "foobar",
    timeout: 60,
    request: {
        "credentials": [
            {
                "credential": "MijnOverheid.address",
                "validity": 1483228800,
                "attributes": {
                    "country": "The Netherlands",
                    "city": "Nijmegen",
                    "street": "Toernooiveld 212",
                    "zipcode": "6525 EC"
                }
            }
        ],
        "disclose": [
            {
                "label": "Age (higher)",
                "attributes": {
                    "MijnOverheid.ageHigher": "present"
                }
            }
        ]
    }
};

$(function() {
    var showWarning = function(msg) {
        $("#alert_box").html('<div class="alert alert-warning" role="alert">'
                             + '<strong>Warning:</strong> '
                             + msg + '</div>');
    };

    var showError = function (msg) {
        $("#alert_box").html('<div class="alert alert-danger" role="alert">'
                             + '<strong>Error:</strong> '
                             + msg + '</div>');
    };

    var success_fun = function(data) {
        $("#alert_box").html('<div class="alert alert-success" role="alert">'
                             + '<strong>Success:</strong> Credentials issued </div>');
    };

    $("#irma_btn").on("click", function() {
        IRMA.issue(iprequest, null, success_fun, showWarning, showError);
    });
});
