var express = require('express');
var bodyParser = require('body-parser');
var ObjectID = require('mongodb').ObjectID;
var db = require('./db');
var func = require('./main');
var request = require('request');
const url = require('url');
var https = require("https");

var app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
  bodyParser.json();
  next();
});


app.get('/', function(req, res)// request - response
{
    res.send("Hello API");
});

app.get('/cars', function(req, res)// request - response
{
    if(req.query.destination)
    {
        const myUrl= url.parse("https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins="+encodeURIComponent(func.originAddress.toString())
            +"&destinations="+encodeURIComponent(req.query.destination.toString())+"&language=uk");
        res.header("Content-Type", "application/json; charset=utf-8");
        var options = {
            url:myUrl,
            method: 'GET'
        };
        //use asios
        request(options, function (error, response, body) {
            if (error) {
                res.send('error:', error);
                return console.log('error:', error);
            }
            //console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            var jsonParsed = JSON.parse(body);
            if(jsonParsed.status!=="OVER_QUERY_LIMIT") {
                var beDeliveredAt = func.calcDateDelivery(jsonParsed.rows[0].elements[0].duration.value);
                var result = {
                    distance: jsonParsed.rows[0].elements[0].distance.text,
                    duration: jsonParsed.rows[0].elements[0].duration.text,
                    beDelivered: beDeliveredAt
                };
                func.createNewDelivery(req.query.destination, result, function (trueOrFalse, message) {
                    if (trueOrFalse)
                        return res.end(JSON.stringify(message));
                    else {
                        return res.end(JSON.stringify(message));
                    }
                });
            }
            else
            {
                return res.end("OVER_QUERY_LIMIT");
            }
        });
    }
    else
    {
        db.get().collection('cars').find().toArray(function (err, docs) {
            if(err)
            {
                console.log(err);
                return res.sendStatus(500);
            }
            res.send(docs);
            });
    }
});

app.get('/deliveries', function(req, res)// request - response
{
    db.get().collection('deliveries').find().toArray(function (err, docs) {
        if(err)
        {
            console.log(err);
            return res.sendStatus(500);
        }
        res.send(docs);
    });
});

app.get('/queue', function(req, res)// request - response
{
    db.get().collection('queue').find().toArray(function (err, docs) {
        if(err)
        {
            console.log(err);
            return res.sendStatus(500);
        }
        res.send(docs);
    });
});


app.get('/cars/:id', function(req, res)// request - response
{
    db.get().collection('cars').findOne({_id:ObjectID(req.params.id)},function (err,doc) {
        if(err)
        {
            console.log(err);
            return res.sendStatus(500);
        }
        res.send(doc);
    })
});

app.post('/cars', function(req, res)// request - response
{
    var car = {
        name:req.body.name,
        sign:req.body.sign,
        isBusy:req.body.isBusy
    };
    db.get().collection('cars').insert(car,function (err,result) {
        if(err)
        {
             console.log(err);
             return res.sendStatus(500);
        }
        else
        {
            //res.send(artist);
            res.sendStatus(200);
        }
    })
    //res.send(artist);
});

app.put('/cars', function(req, res)// request - response
{
    var car = req.body;
    console.log(car);
    console.log(req.get('temp'));
    db.get().collection('cars').updateOne(
        {_id:ObjectID(car._id)},
        {
            $set:{
              "name": car.name,
              "sign": car.sign,
              "isBusy": car.isBusy,
              "willBeFree": car.willBeFree,
              "deliveryID": car.deliveryID
            }
        },
        function (err,result) {
            if(err)
            {
                console.log(err);
                return res.sendStatus(500);
            }
        res.sendStatus(200);
    });
});



app.delete('/cars/:id', function(req, res)// request - response
{
    db.get().collection('cars').deleteOne(
        {_id:ObjectID(req.params.id)},
        function (err,result) {
            if(err)
            {
                console.log(err);
                return res.sendStatus(500);
            }
            res.sendStatus(200);
        });
});

app.delete('/deliveries/:id', function(req, res)// request - response
{
    db.get().collection('deliveries').deleteOne(
        {_id:ObjectID(req.params.id)},
        function (err,result) {
            if(err)
            {
                console.log(err);
                return res.sendStatus(500);
            }
            res.sendStatus(200);
        });
});

db.connect('mongodb://localhost:27017/mydb',function (err) {
    if(err)
    {
        return console.log(err);
    }
    app.listen(3012,function () {
        func.runMyCrone();
        console.log('the app started');
    })
    //originAddress = new String('Героїв УПА 73 Львів');
})
