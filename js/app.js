/* Angular Module Definition */
var myApp = angular.module('myModule', ['oitozero.ngSweetAlert']);

/* File Upload Directive */
myApp.directive('fileModel', ['$parse', function ($parse) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            var model = $parse(attrs.fileModel);
            var modelSetter = model.assign;

            element.bind('change', function () {
                scope.$apply(function () {
                    modelSetter(scope, element[0].files[0]);
                });
            });
        }
    };
}]);

/* File Upload Service */
myApp.service('fileUpload', ['$http', function ($http) {
	return {
		uploadFileAndFieldsToUrl: function(file, uploadUrl) {
			var fd = new FormData();
			fd.append('file', file);
			return $http.post(uploadUrl, fd, {headers: {'Content-Type': undefined}, transformRequest: angular.identity});
		}
	};
}]);

/* Main Page Form Controller */
myApp.controller('mainPage', ['SweetAlert', '$scope', 'fileUpload', '$http', '$filter', '$window', function (SweetAlert, $scope, fileUpload, $http, $filter, $window) {		
	
	$scope.startShopping = function(){
		$window.location.href= '/shopping.html';
    }
	
	$scope.startChatBot = function(){
		$window.location.href= '/chatbot.html';
    }
	
}]);

/* Classify Image Form Controller */
myApp.controller('classifyImage', ['SweetAlert', '$scope', 'fileUpload', '$http', '$filter', '$window', function (SweetAlert, $scope, fileUpload, $http, $filter, $window) {	
    $scope.$watch('myFile', function (newFileObj) {
        if (newFileObj)
            $scope.filename = newFileObj.name;
    });	
	
	$scope.confirm = function(title, text, type){
		SweetAlert.swal({title: title, text: text, type: type},function(){ 
						$window.location.href= '/index.html';
				   });
    }
	
	$scope.error = function(title, text, type){
		SweetAlert.swal({title: title, text: text, type: type});
    }

    $scope.classifyImgVisual = function () {
        $scope.isDisabled = true;
		$scope.list = [];
 		var file = $scope.myFile;
        var uploadUrl = "/classifyImg";
		fileUpload.uploadFileAndFieldsToUrl(file, uploadUrl).then(function (uploadResponse) {
			if(uploadResponse.data.result){
				var classes = uploadResponse.data.result.images[0].classifiers[0].classes;
				var score = 0;
				var category = '';
				for(var i=0; i<classes.length; i++){
					if(classes[i].score > score){
						score = classes[i].score;
						category = classes[i].class;
					}
				}
				if(category != ''){
					var data = {
						data: category
					}				
					$http({
						method: 'POST',
						url: '/getProductsAsPerCategory',
						data: data
					}).then(function successCallback(response) {
						if (response.data.success == true) {
							if(response.data.result && response.data.result.length > 0){
								for (var i = 0; i < response.data.result.length; i++) {
									var map = new Object();
									map['id'] = response.data.result[i]._id;
									map['imgUrl'] = "data:image/gif;base64,"+response.data.result[i].fileBase64Data;
									$scope.list.push(map);
								}
							}else{
								$scope.error('No related products found as per the uploaded image category !!', '', 'error');
							}							
						} else {
							$scope.error(response.data.message, '', 'error');
						}
					});
				}else{
					$scope.error('Product category is not defined in the model !!', '', 'error');
				}
			}else{
				$scope.error('Issues classifying the image !!', '', 'error');
			}
		});
	}		

    $scope.openProductDetails = function (productId) {
        $scope.isDisabled = true;

        var data = {
            data: productId
        }

        $http({
            method: 'POST',
            url: '/getProductIdData',
            data: data
        }).then(function successCallback(response) {
            if (response.data.success == true && response.data.result) {
				$scope.currentProductData = response.data.result[0];
				$scope.id = $scope.currentProductData._id;
				$scope.productImgUrl = "data:image/gif;base64,"+$scope.currentProductData.fileBase64Data;
				$scope.cost = $scope.currentProductData.productCost;
				$scope.details = $scope.currentProductData.productDescription;
				var list = [];
				for(var j=1; j<=$scope.currentProductData.productQuantity; j++){
					list.push(j);
				}
				$scope.accountId = $scope.currentProductData.accountId;
				$scope.quantity = list;
				$scope.size = $scope.currentProductData.productSize;
            } else {
				$scope.error(response.data.message, '', 'error');
            }
        });		
		
	}
    $scope.calculatePrice = function () {
		$scope.totalCost = $scope.productCount * $scope.cost;
	}
	
    $scope.buyProduct = function (productId) {

        var orderData = {
			_id: 'O-'+Date.now(),
            productId: $scope.id,
			accountId: $scope.accountId,
			quantity: $scope.productCount,
			totalCost: $scope.totalCost,
			dateOfOrderPlaced: Date.now(),
			productDescription: $scope.details
        }
		
		var data = {
			data : orderData,
			updateData : $scope.currentProductData
		}

        $http({
            method: 'POST',
            url: '/addOrderDataToDB',
            data: data
        }).then(function successCallback(response) {
            if (response.data.success == true) {
				$scope.confirm('Order placed successfully with order id as '+response.data.response.id, '', 'success');			
            } else {
                $scope.error(response.data.message, '', 'error');
            }
        });		
		
	}
}]);

/* Chat Bot Controller */
myApp.controller('chatbotController', ['SweetAlert', '$rootScope', '$scope', '$compile', 'fileUpload', '$http', '$filter', '$window', function (SweetAlert,  $rootScope, $scope, $compile, fileUpload, $http, $filter, $window) {

	//Close Session
	$scope.closeSession = function () {
		$window.location.href= '/index.html';
	}
	//Overlay On
	$scope.on = function () {
		document.getElementById("overlay").style.display = "block";
	}
	//Overlay Off
	$scope.off = function () {
		document.getElementById("overlay").style.display = "none";
	}
	//Start Chat
	$scope.startChat = function () {
		$scope.chatUserName = $scope.userName;
		$scope.chatStartTime = new Date();
		var time = new Date().getHours() + ':' + new Date().getMinutes();
		$scope.off();
		$scope.createBotChatBox($scope.chatUserName, 'Hi ' + $scope.chatUserName + ' . Can u please provide me with the order Id for your product.', time);
	}
	//Send Chat
	$scope.sendChat = function () {
		$scope.chatUserName = $scope.userName;
		$scope.chatStartTime = new Date();
		var msg = $scope.userMsg;
		var time = new Date().getHours() + ':' + new Date().getMinutes();
		$scope.userMsg = '';
		$scope.createUserChatBox($scope.chatUserName, msg, time);
	}
	// Create chat box window for user
	$scope.createUserChatBox = function (userName, textData, time) {
		var elementToAdd = angular.element(document.querySelector('#chatbot'));
		var html = '<div class="row"><div class="col-lg-12"><div class="media"><a class="pull-left" href="#"><img class="media-object img-circle img-chat" src="./img/user.png" alt=""></a><div class="media-body"><h4 class="media-heading">' + userName + '<span class="small pull-right">' + time + '</span></h4><p>' + textData + '</p></div></div></div></div><hr>';
		elementToAdd.append(html);
		$compile(elementToAdd)($scope);
		if(textData.includes('O-')){
			$scope.fetchOrderDetails(textData);
		}else if(textData.includes('ok') || textData.includes('Ok') || textData.includes('OK') || textData.includes('yes') || textData.includes('Yes') || textData.includes('YES')){
			var time = new Date().getHours() + ':' + new Date().getMinutes();
			$scope.createBotChatBox('Sales Bot', 'The product was ordered on '+$scope.orderedDate+' and will be delivered within 3 days. Can i help you for something else.', time);			
		}else if(textData.includes('no') || textData.includes('No') || textData.includes('NO')){
			var time = new Date().getHours() + ':' + new Date().getMinutes();
			$scope.createBotChatBox('Sales Bot', 'Thanks for using our services. It was great to assist you.', time);			
		}
	};
	// Create chat box window for bot
	$scope.createBotChatBox = function (userName, textData, time) {
		var elementToAdd = angular.element(document.querySelector('#chatbot'));
		var html = '<div class="row"><div class="col-lg-12"><div class="media"><a class="pull-left" href="#"><img class="media-object img-circle img-chat" src="./img/bot.png" alt=""></a><div class="media-body"><h4 class="media-heading">Sales Bot<span class="small pull-right">' + time + '</span></h4><p>' + textData + '</p></div></div></div></div><hr>';
		elementToAdd.append(html);
		$compile(elementToAdd)($scope);
	};
	
	$scope.fetchOrderDetails = function (orderId){
		var data = {
			data : orderId
		}
		
        $http({
            method: 'POST',
            url: '/getOrderIdData',
            data: data
        }).then(function successCallback(response) {
            if (response.data.success == true && response.data.result) {
				var data = response.data.result[0];
				var msg = 'Do you want to enquire about the '+data.productDescription+'. For this order the quantity you specified is '+data.quantity+' and total price paid by you is '+data.totalCost;
				var time = new Date().getHours() + ':' + new Date().getMinutes();
				$scope.orderedDate = data.dateOfOrderPlaced;
				$scope.createBotChatBox('Sales Bot', msg, time);
            } else {
                $scope.error(response.data.message, '', 'error');
            }
        });
	}
}]);