// ------- Just some testing rubbish -------

var internal = 0;

function inc() {
    console.log("Increasing internal counter");
    internal = internal + 2;
}

function report() {
    console.log("Internal: ", internal);
}

// --------- Real future IRMA stuff -----

function startAuthentication(authDesc, success, failure) {
    console.log("IRMA starting authentication");
    window.addEventListener('message', function (e) {
        console.log("Received message: ", e.data);
        if(e.data.status === "success") {
            success(e.data.message);
        } else {
            failure(e.data.message);
        }
    }, false);
    var popup = window.open("../server/authenticate.html",'name','height=400,width=640');
    if (window.focus) {
        popup.focus();
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
        startAuthentication("blaat", success_fun, error_fun);
    });
}

export {inc, report, startAuthentication, init};
