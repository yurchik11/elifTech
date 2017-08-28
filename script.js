/**
 * Created by yurik on 05.08.2017.
 */

function getCars() {
    $.ajax({
        type:"GET",
        url: 'http://localhost:3012/cars',
        //data: "",
        //response:"jsonp",
        success: function(data) {
            alert(data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            alert('error ' + textStatus + " " + errorThrown);
        }
    });
};