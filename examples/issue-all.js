$(function() {
    IRMA.init("<IRMA_WEB_SERVER>", "<IRMA_API_SERVER>");

    var iprequest = {
        data: "foobar",
        timeout: 60,
        request: {},
    };

    var credentials = {"creds": [
        {
            "credential": "irma-demo.MijnOverheid.fullName",
            "attributes": {
                "firstnames": "Johan Pieter",
                "firstname": "Johan",
                "familyname": "Stuivezand",
                "prefix": "van"
            }
        },
        {
            "credential": "irma-demo.MijnOverheid.address",
            "attributes": {
                "country": "The Netherlands",
                "city": "Nijmegen",
                "street": "Toernooiveld 212",
                "zipcode": "6525 EC"
            }
        },
        {
            "credential": "irma-demo.MijnOverheid.ageLower",
            "attributes": {
                "over12": "yes",
                "over16": "yes",
                "over18": "yes",
                "over21": "no"
            }
        },
        {
            "credential": "irma-demo.MijnOverheid.ageHigher",
            "attributes": {
                "over50": "no",
                "over60": "no",
                "over65": "no",
                "over75": "no"
            }
        },
        {
            "credential": "irma-demo.MijnOverheid.idDocument",
            "attributes": {
                "type": "passport",
                "number": "HQVA1ZBR3",
                "expires": "Jan 1, 2020",
                "nationality": "NLD"
            }
        },
        {
            "credential": "irma-demo.RU.studentCard",
            "attributes": {
                "university": "Radboud University",
                "studentCardNumber": "0812345673",
                "studentID": "s1234567",
                "level": "Student"
            }
        },
        {
            "credential": "irma-demo.MijnOverheid.birthCertificate",
            "attributes": {
                "dateofbirth": "29-2-2004",
                "placeofbirth": "Stuivezand",
                "countryofbirth": "Nederland",
                "gender": "male"
            }
        },
        {
            "credential": "irma-demo.MijnOverheid.root",
            "attributes": {
                "BSN": "123456789",
            }
        },
        {
            "credential": "irma-demo.IRMATube.member",
            "attributes": {
                "type": "regular",
                "id": "123456"
            }
        },
    ]};

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

    Handlebars.registerHelper( 'eachInMap', function ( map, block ) {
       var out = '';
       Object.keys( map ).map(function( prop ) {
          out += block.fn( {key: prop, value: map[ prop ]} );
       });
       return out;
    });

    function renderForm() {
        var templateSrc = $("#credentials-template").html();
        console.log(templateSrc);
        var template = Handlebars.compile(templateSrc);
        $("#credential-forms").html(template(credentials));
    }

    renderForm();


    function startIssuance() {
        // Clear errors
        $(".form-group").removeClass("has-error");
        $("#alert_box").empty();

        resultCredentials = [];
        var error = false;

        $.each(credentials.creds, function(idx, credential) {
            console.log("Retrieving credential", credential);
            var credentialName = credential.credential;

            resultCredential = {
                "credential": credentialName,
                "attributes": {},
            }

            $.each(credential.attributes, function(attributeName, attributeVal) {
                // Annoying: need to escape the dots for the jQuery query
                var jqID = (credentialName + "." + attributeName).replace( /(:|\.|\[|\]|,)/g, "\\$1" )
                var input = $("#input\\." + jqID).prop("value");

                if (input === "") {
                    error = true;
                    $("#formGroup\\." + jqID).addClass("has-error");
                } else {
                    resultCredential.attributes[attributeName] = input;
                }
            });
            resultCredentials.push(resultCredential);
        });

        if (error) {
            showWarning("Fields may not be empty");
            return;
        }

        iprequest.request.credentials = resultCredentials;
        console.log(iprequest);
        var jwt = IRMA.createUnsignedIssuanceJWT(iprequest);
        IRMA.issue(jwt, success_fun, showWarning, showError);
    };

    $("#irma_btn_top").on("click", startIssuance);
    $("#irma_btn_bottom").on("click", startIssuance);
});
