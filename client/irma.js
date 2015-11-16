// --------- Real future IRMA stuff -----

function authentication(authDesc, success, failure) {
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


export {inc, report, startAuthentication, init};
