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
        callback(e.data);
    }, false);
    var popup = window.open("../server/authenticate.html",'name','height=400,width=600');
    if (window.focus) {
        popup.focus();
    }
};

export {inc, report, startAuthentication};
