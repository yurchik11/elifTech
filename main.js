/**
 * Created by yurik on 05.08.2017.
 */
var db = require('./db');
var ObjectID = require('mongodb').ObjectID;
var Agenda = require('agenda');
var originAddress=new String('Героїв УПА 73 Львів');
var MyApp = {};

exports.originAddress=originAddress;

exports.calcDateDelivery = function (timeDelivery) {
    var date = new Date();
    var beDelivered = new Date(date.getTime() + timeDelivery*1000);
    var res = {
        "BeDeliveredDateFormat":beDelivered,
        "TimeDelivery":timeDelivery
    };
    return res;
}

exports.createNewDelivery=function(destination,result,callback) {
    db.get().collection('cars').findOne({isBusy:false},function (err,doc) {
        if(err)
        {
            console.log(err);
            return callback(false, err);
        }
        else {
            if (!doc) {
                console.log("not available free car");
                getNearestCar(function (nearestCar) {
                    if(nearestCar!==0)
                            insertDeliveryIntoQueue(nearestCar,destination,result, function (resQueue) {
                                console.log("Successfully added new delivery into queue");
                                return callback(true, resQueue);
                            });
                        });
            }
            else {
                console.log("available free car");
                var delivery = {
                    origin: originAddress.toString(),
                    departure: destination,
                    beDeliveredDateFormat: result.beDelivered.BeDeliveredDateFormat,
                    timeDelivery: result.duration,
                    distanceDelivery: result.distance,
                    status:"in progress"
                };
                MyApp.willBeFree = result.beDelivered.BeDeliveredDateFormat;
                MyApp.delivery = delivery;
                db.get().collection('deliveries').insert(delivery, function (err, result,delivery) {
                    if (err) {
                        console.log(err);
                        return callback(false, err);
                    }
                    else {
                        console.log("New delivery created");
                        db.get().collection('cars').updateOne(
                            {_id: ObjectID(doc._id.toString())},
                            {
                                $set: {
                                    "isBusy": true,
                                    "deliveryID":result["ops"][0]["_id"].toString(),
                                    "willBeFree": MyApp.willBeFree
                                }
                            },
                            function (err, result) {
                                if (err) {
                                    console.log(err);
                                    return callback(false, err);
                                }
                                else
                                {
                                    return callback(true, MyApp.delivery);
                                }
                            });
                    }
                });
            }
        }
    });
}

var getNearestCar = function (callback) {
    db.get().collection('cars').aggregate(
        [
            {
                $sort:{willBeFree:1}
            }
        ], function (err,docs) {
            if(err)
            {
                console.log(err);
                return callback(0);
            }
            else
            {
                //console.log(docs);
                callback(docs[0]);
            }

        }
    );
}

var insertDeliveryIntoQueue = function (nearestCar, destination, result, callback) {
    var newDate = new Date(nearestCar.willBeFree.getTime() + result.beDelivered.TimeDelivery*1000);
    var myQueue = {
        origin:originAddress.toString(),
        departure:destination,
        timeDelivery:result.duration,
        distanceDelivery:result.distance,
        approxWillBeDelivered: newDate,
    };
    db.get().collection('queue').insert(myQueue,function (err,result) {
        if(err)
        {
            return console.log(err);
        }
        else
        {
            //console.log("New delivery created");
            db.get().collection('cars').updateOne(
                {_id: nearestCar._id},
                {
                    $set: {
                        "willBeFree": newDate
                    }
                },
                function (err, result) {
                    if (err) {
                        console.log(err);
                        return callback({});
                    }
                    else
                    {
                        console.log("Updated willBeFree date for car!")
                        return callback(myQueue);
                    }
                });
        }
    });
}

exports.runMyCrone=function () {
    var mongoConnectionString = 'mongodb://127.0.0.1/agenda';
    var agenda = new Agenda({db: {address: mongoConnectionString}});
    agenda.define('checkQueue', function(job,done) {
        //console.log("new agenda job scheduler created");
        db.get().collection('cars').findOne({ willBeFree: { $lte: new Date() }},function (err, doc) {
            if (err) {
                return console.log(err);
            }
            else if(doc)
            {
                MyApp.CarID = doc._id;
                updateStatusDelivery(doc.deliveryID, function (status) {
                    if(status)
                    {
                        getFirsInQueue(function (myQueue) {
                            if(myQueue)
                            {
                                insertQueueIntoDeliveries(myQueue,function (delivery) {
                                    if(delivery)
                                    {
                                        setCarForDelivery(delivery,MyApp.CarID, function (status) {
                                            if(status)
                                                return done();
                                        });
                                    }
                                    else
                                    {
                                        return done();
                                    }
                                })
                            }
                            else
                            {
                               return done();
                            }
                        })
                    }
                });
            }
            else
            {
                console.log("no free cars");
                return done();
            }
        });
    });
    agenda.on('ready', function() {
        agenda.every('10 seconds', 'checkQueue');
        // Alternatively, you could also do:
        //agenda.every('*/3 * * * *', 'checkQueue');
        agenda.start();
        console.log("crone was started")
    });
}

var updateStatusDelivery = function(deliveryID,callback) {
    db.get().collection('deliveries').updateOne(
        {_id: ObjectID(deliveryID)},
        {
            $set: {
                "status": "completed"
            }
        },
        function (err, result) {
            if (err) {
                console.log(err);
                return callback(false);
            }
            else
            {
                console.log("delivery status was updated!")
                return callback(true);
            }
        });
};
var getFirsInQueue = function (callback) {
    db.get().collection('queue').findOne(function (err, doc){
        if (err) {
            console.log(err);
            return callback(null);
        }
        else
        {
            if(doc) {
                console.log("move first delivery from queue into deliveries");
                deleteFirstInQueue(doc._id);

            }
            else
            {
                console.log("queue is empty");
            }
            return callback(doc);
        }
    });
};

var deleteFirstInQueue = function (id) {
    db.get().collection('queue').deleteOne(
        {_id:id},
        function (err,result) {
            if(err)
            {
                console.log("deleted first delivery in queue");
                return console.log(err);
            }
        });
}

var insertQueueIntoDeliveries = function (myQueue, callback) {
    var temp = myQueue.approxWillBeDelivered;
    delete myQueue.approxWillBeDelivered;
    delete myQueue._id;
    myQueue.beDeliveredDateFormat = temp;
    db.get().collection('deliveries').insert(myQueue, function (err, result) {
        if (err) {
            console.log(err);
            return callback(null);
        }
        else
        {
            return callback(result["ops"][0]);
        }
    });
}

var setCarForDelivery = function (delivery,carID, callback) {
    db.get().collection('cars').updateOne(
        {_id: ObjectID(carID)},
        {
            $set: {
                "deliveryID": delivery._id,
                "willBeFree": delivery.beDeliveredDateFormat
            }
        },
        function (err, result) {
            if (err) {
                console.log(err);
                return callback(false);
            }
            else
            {
                console.log("car detail was updated for new delivery!");
                return callback(true);
            }
        });
}