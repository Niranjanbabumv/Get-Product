var express = require('express');
var path = require('path');
var fs = require('fs');
var bodyParser = require('body-parser');
var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');
var port = process.env.PORT || process.env.VCAP_APP_PORT || '8080';
var app = express();
var multer = require('multer');
var Cloudant = require('@cloudant/cloudant');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
var upload = multer({
    dest: __dirname + '/upload'
});
var type = upload.single('file');

app.use('/', express.static(__dirname + '/'));

var visualRecognition = new VisualRecognitionV3({
	version: '2018-03-19',
	iam_apikey: 'BT3UU2CBKHaCPljVZAzT4ZogBlhgsW3Z2G17vdWVPQgq'
});

var cloudantUserName = '57034c71-949b-496a-a201-c531d9e0f5b3-bluemix';
var cloudantPassword = '4ba5f7b783631c8538f18f50773288414d5ff1edbe0a5dd0dfe9b29543a2dfd6';
var cloudant_url = 'https://' + cloudantUserName + ':' + cloudantPassword + '@' + cloudantUserName + '.cloudant.com';
var cloudant = Cloudant(cloudant_url);
var dbForProductInfo = cloudant.db.use('product_info');
var dbForOrderInfo = cloudant.db.use('order_info');

//Starting page when server starts
app.get('/', function (req, res) {
    console.log('Open index.html page');
    res.sendFile(path.join(__dirname + '/index.html'));
});
//Create index on product db for product category field if not existing
var productCategory = {
    name: 'productCategory',
    type: 'json',
    index: {
        fields: ['productCategory']
    }
};
dbForProductInfo.index(productCategory, function (er, response) {
    if (er) console.log('Error creating index of product category : ' + er);
    else console.log('Index creation result of product category : ' + response.result);
});
//Create index on product db for product id field if not existing
var _id = {
    name: '_id',
    type: 'json',
    index: {
        fields: ['_id']
    }
};
dbForProductInfo.index(_id, function (er, response) {
    if (er) console.log('Error creating index of product id : ' + er);
    else console.log('Index creation result of product id : ' + response.result);
});
//Create index on order db for orderId field if not existing
var orderId = {
    name: '_id',
    type: 'json',
    index: {
        fields: ['_id']
    }
};
dbForOrderInfo.index(orderId, function (er, response) {
    if (er) console.log('Error creating index on orderId : ' + er);
    else console.log('Index creation result on orderId : ' + response.result);
});
/* Classify image to find the uploaded image category */
app.post('/classifyImg', type, function (req, res) {
    console.log('Inside Express api to classify image to find the category');
	var images_file= fs.createReadStream(__dirname + '/upload/' + req.file.filename);
	var classifier_ids = ["acme-vr-nb_117556229"];
	var threshold = 0.5;
	var params = {
		images_file: images_file,
		classifier_ids: classifier_ids,
		threshold: threshold
	};
	visualRecognition.classify(params, function(err, response) {
		if (err) { 
			res.json({
				success: false,
				message: 'Visual recognition connectivity issue !'
			});
		} else {
			fs.unlink(__dirname + '/upload/' + req.file.filename, function (err) {
				if (!err)
					console.log('File deleted !');
				else 
					console.log('Issue deleting File');
			});
            res.json({
                success: true,
                message: 'Product category found successfully ! ',
                result: response
            });
		}
	});
});
//Get product data based on category code from DB
app.post('/getProductsAsPerCategory', type, function (req, res) {
    console.log('Inside Express api to get all products as per category code');
    getProductDetails(req.body.data).then(function (data) {
        if (data.success) {
            res.json({
                success: true,
                message: 'Product data found successfully ! ',
                result: data.response.docs
            });
        } else res.json({
            success: false,
            message: 'Cloudant db connectivity issue !'
        });
    });
});
//Get product data based on product id from DB
app.post('/getProductIdData', type, function (req, res) {
    console.log('Inside Express api to get specific product data');
    getProductDetail(req.body.data).then(function (data) {
        if (data.success) {
            res.json({
                success: true,
                message: 'Product data found successfully ! ',
                result: data.response.docs
            });
        } else res.json({
            success: false,
            message: 'Cloudant db connectivity issue !'
        });
    });
});
//Get order data based on order id from DB
app.post('/getOrderIdData', type, function (req, res) {
    console.log('Inside Express api to get specific order data');
    getOrderDetail(req.body.data).then(function (data) {
        if (data.success) {
            res.json({
                success: true,
                message: 'Order data found successfully ! ',
                result: data.response.docs
            });
        } else res.json({
            success: false,
            message: 'Cloudant db connectivity issue !'
        });
    });
});
//Add order details to DB
app.post('/addOrderDataToDB', type, function (req, res) {
    console.log('Inside Express api to insert details about order');
    var orderData = req.body.data;
	var updateData = req.body.updateData;
	updateData.productQuantity = updateData.productQuantity - orderData.quantity;
 	insertOrderData(orderData).then(function (data) {
	if (data.success){
		updateCloudantData(updateData).then(function (updateRes) {
			if (updateRes.success)
				res.json({ success: true, message: 'Order data inserted successfully !', response: data.response });
			else
				res.json({ success: true, message: 'Issue updating data in cloudant for product db !' });
		})
	}else
		res.json({ success: false, message: 'Issue inserting order data !' });	
	});
});
//Fetch all products based on category code from cloudant DB
var getProductDetails = async (category) => {
    try {
        var response = await dbForProductInfo.find({
            selector: {
                productCategory: category
            }
        });
        console.log('Product data found successfully ! ');
        return ({
            success: true,
            message: 'Product data found successfully ! ',
            response: response
        });
    } catch (err) {
        console.log('Product data not present/DB issue ! ' + err);
        return ({
            success: false,
            message: 'Product data not present/DB issue !'
        });
    }
}
//Fetch product based on product id from cloudant DB
var getProductDetail = async (productId) => {
    try {
        var response = await dbForProductInfo.find({
            selector: {
                _id: productId
            }
        });
        console.log('Product data found successfully ! ');
        return ({
            success: true,
            message: 'Product data found successfully ! ',
            response: response
        });
    } catch (err) {
        console.log('Product data not present/DB issue ! ' + err);
        return ({
            success: false,
            message: 'Product data not present/DB issue !'
        });
    }
}
//Fetch order based on order id from cloudant DB
var getOrderDetail = async (orderId) => {
    try {
        var response = await dbForOrderInfo.find({
            selector: {
                _id: orderId
            }
        });
        console.log('Order data found successfully ! ');
        return ({
            success: true,
            message: 'Order data found successfully ! ',
            response: response
        });
    } catch (err) {
        console.log('Order data not present/DB issue ! ' + err);
        return ({
            success: false,
            message: 'Order data not present/DB issue !'
        });
    }
}
// Insert order details in cloudant DB
var insertOrderData = async (data) => {
    try {
		var data = await dbForOrderInfo.insert(data);
		console.log('Order Info Inserted !');
		return ({
			success: true,
			message: 'Order Info Inserted Successfully !',
			response: data
		});
    } catch (err) {
        console.log('Issue fetching/inserting data from DB ! ' + err);
        return ({
            success: false,
            message: 'Issue fetching/inserting data from DB !'
        });
    }
}
// Update existing product record in cloudant DB
var updateCloudantData = async (data) => {
	try {
		var response = await dbForProductInfo.insert(data);
        console.log('Applicant data updated successfully ! ');
        return ({
            success: true,
            message: 'Applicant data updated successfully ! '
        });
    } catch (err) {
        console.log('Applicant data updation issue ! ' + err);
        return ({
            success: false,
            message: 'Applicant data updation issue !'
        });
    }
}
app.listen(port);