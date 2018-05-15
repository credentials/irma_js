$(function() {
    IRMA.init("<IRMA_WEB_SERVER>", "<IRMA_API_SERVER>");    
    
    // Setup verification request
    var sprequest = {
        "validity": 60,
        "request": {
            "content": []
        }
    };

    function showWarning(msg) {
        $("#alert_box").html('<div class="alert alert-warning" role="alert">'
                             + '<strong>Warning:</strong> '
                             + msg + '</div>');
    };

    function showError(msg) {
        $("#alert_box").html('<div class="alert alert-danger" role="alert">'
                             + '<strong>Error:</strong> '
                             + msg + '</div>');
    };

    function init() {
        console.log("Init called!");

        var success_fun = function(data) {
            $("#alert_box").html('<div class="alert alert-success" role="alert">'
                                 + '<strong>Success:</strong> '
                                 + 'Attributes verified </div>');

            token = jwt_decode(data);
            $("#attribute_heading").show();
            $("#attribute_list").show();
            console.log(token);
            $.each(token.attributes, function(attribute, value) {
                $("#attribute_list_data").append("<tr>"
                    + "<td>" + attribute + "</td>"
                    + "<td>" + value + "</td></tr>");
            });
        }

        $("#irma_btn").on("click", function() {
            $("#alert_box").empty();
            $("#attribute_list").hide();
            $("#attribute_list_data").empty();
            $("#attribute_heading").hide();
            sprequest.request.content = [];

            var notEmpty = false;
            // Add only those attributes to the request for which checkbox is checked
            $.each(["over16", "over18", "firstname", "familyname"], function(idx, val) {
                elem = $("#" + val);
                if( elem.prop("checked") ) {
                    attribute = elem.attr("value");
                    sprequest.request.content.push( {
                            "label": val,
                            "attributes": [attribute]
                    });
                    notEmpty = true;
                }
            });

            if (notEmpty) {
                var jwt = IRMA.createUnsignedVerificationJWT(sprequest);
                IRMA.verify(jwt, success_fun, showWarning, showError);
            } else {
                showWarning("Please select at least one attribute");
            }
        });
    }

    init();
});
