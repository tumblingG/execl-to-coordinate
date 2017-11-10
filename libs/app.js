/* xlsx.js (C) 2013-present SheetJS -- http://sheetjs.com */
var app = angular.module('app', [
	'ngAnimate',
	'ngTouch',
	'ui.grid',
	'ui.grid.selection',
	'ui.grid.exporter',
	'ui.grid.edit',
    'ui.grid.autoResize',
	'angular-clipboard',
	'toastr',
    'ui.bootstrap'
]);

app.config(['$qProvider', 'toastrConfig', function($qProvider, toastrConfig) {
	$qProvider.errorOnUnhandledRejections(false);
    angular.extend(toastrConfig, {
        progressBar: true
    });
}]);

/* Inject SheetJSExportService */
app.factory('SheetJSExportService', SheetJSExportService);
SheetJSExportService.inject = ['uiGridExporterService'];

app.controller('MainCtrl', [
	'$scope',
	'$q',
	'SheetJSExportService',
	'clipboard',
	'toastr',
    '$uibModal',
	function ($scope, $q, SheetJSExportService, clipboard, toastr, $uibModal) {
	$scope.gridOptions = {
		columnDefs: [
			{name: 'id', displayName: 'id',enableFiltering: false,width: 50, cellTemplate: '<div class="ui-grid-cell-contents">{{row.grid.renderContainers.body.visibleRowsCache.indexOf(row) + 1}}</div>' },
			{ field: 'name', enableCellEdit: true},
			{ field: 'address', enableCellEdit: true},
			{ field: 'city', enableCellEdit: true}
		],
		multiSelect: false,
		showGridFooter: true,
		enableFiltering: true,
		enableGridMenu: true,
		enableRowHeaderSelection : false,
		enableSelectAll: false,
        /*不导出id列*/
        exporterSuppressColumns:[ 'id' ],
        /*导出前转标题头为小写*/
        exporterHeaderFilter: function(name) { return angular.lowercase(name);},
		exporterMenuPdf: false,
		exporterMenuCsv: true,
        exporterCsvFilename: 'Sheet.csv',
		showHeader: true,
		onRegisterApi: function(gridApi){
			$scope.gridApi = gridApi;
		},
		/* SheetJS Service setup */
		filename: "Sheet",
		sheetname: "Sheet1",
		gridMenuCustomItems: [
			{
				title: 'Export all data as XLSX',
				action: function ($event) { SheetJSExportService.exportXLSX($scope.gridApi); },
				order: 200
			},
			{
				title: 'Export all data as XLSB',
				action: function ($event) { SheetJSExportService.exportXLSB($scope.gridApi); },
				order: 201
			}
		]
	};

	$scope.code = '{}';
	$scope.total = 0;
	$scope.count = 0;
    $scope.method = "sync";

	$scope.getBDPosition = function () {
		var data = $scope.gridApi.core.getVisibleRows($scope.gridApi.grid);
		if (!data || data.length == 0) {
            toastr.error('请先选择文件！');
			return;
		}

		$scope.code = '{}';
		$scope.count = 0;
		var index = 0;
		var len = data.length;
        var promiseArr = [];
		$scope.total = len;
		var positions = {};
		var myGeo = new BMap.Geocoder();

        if ($scope.method === 'sync') {
            bgGEO();
        }else {
            AsyncGeo();
        }

		function bgGEO() {
            if (index < len) {
                var item = data[index].entity;
                if(!item.address || !item.name) {
                    $scope.total--;
                    index++;
                    bgGEO();
                }else {
                    var promise = geocodeSearch(item);
                    promise.then(function(){
                        if (++index === len) {
							toastr.success('数据转换成功！');
                            var json = JSON.stringify(positions, 2, 2);
                            $scope.code = json;
                            var blob = new Blob([json], {type: "text/json;charset=utf-8"});
                            saveAs(blob, "map.json");
                        }else {
                            bgGEO();
                        }
                    }).catch(function(e) {
						toastr.error('数据转换失败！');
						console.log(e);
                    })
                }
            }
		}

		function geocodeSearch(item) {

			var deferred = $q.defer();
			myGeo.getPoint(item.address, function(point){
				if (point) {
					positions[item.name] = [point.lng, point.lat];
				}else {
					positions[item.name] = [];
				}
				deferred.resolve();
				$scope.count++;
			}, item.city);

			return deferred.promise;
		}

        function AsyncGeo() {
            for (var i = 0; i < len; i++) {
                var item = data[i].entity;
                if(!item.address || !item.name) {
                    $scope.total--;
                    continue;
                };

                var deferred = $q.defer();
                promiseArr.push(deferred.promise);
                (function(item, deferred) {
                    myGeo.getPoint(item.address, function(point){
                        if (point) {
                            positions[item.name] = [point.lng, point.lat];
                        }else {
                            positions[item.name] = [];
                        }
                        deferred.resolve();
                        $scope.count++;
                    }, item.city);
                })(item,deferred);
            }

            $q.all(promiseArr).then(function() {
				toastr.success('数据转换成功！');
                var json = JSON.stringify(positions, 2, 2);
                $scope.code = json;
                var blob = new Blob([json], {type: "text/json;charset=utf-8"});
                saveAs(blob, "map.json");
            }).catch(function(e) {
				toastr.error('数据转换失败！');
				console.log(e);
            });
        }
	};

	$scope.reset = function() {
		document.getElementById('myform').reset();
		$scope.gridOptions.data = [];
		$scope.code = '{}';
		$scope.total = 0;
		$scope.count = 0;
	};

	$scope.delete = function() {
		var currentSelection = $scope.gridApi.selection.getSelectedRows();
		if (!currentSelection.length) {
			toastr.warning('请先选择一行数据！');
			return false;
		}
		var id = currentSelection[0].id;
		var data = $scope.gridOptions.data;
		var len = data.length;
		var i = 0;
		for (i = 0; i< len; i++) {
			if (data[i].id === id) {
				break;
			}
		}
		if(i !== len) {
			data.splice(i, 1);
			toastr.success('删除成功！');
		}else {
			toastr.error('找不到数据！');
		}

	};

	$scope.copySuccess = function(){
		toastr.success('复制成功！');
	};

	$scope.copyFail = function(err) {
		toastr.error('复制失败：' + err);
	};

	$scope.supported = clipboard.supported;

    $scope.open = function() {
        var modalInstance = $uibModal.open({
            animation: true,
            component: 'modalComponent'
        });

        modalInstance.result.then(function (modal) {
            $scope.gridOptions.data.push(modal)
        }, function () {

        });
    }

}]);

app.directive("importSheetJs", [SheetJSImportDirective]);

app.component('modalComponent', {
    templateUrl: 'myModalContent.html',
    bindings: {
        close: '&',
        dismiss: '&'
    },
    controller: [function() {

        this.modal = {};

        this.submited = false;

        this.ok = function (form) {
            this.submited = true;
            if(form.$valid) {
                this.close({$value: this.modal});
            }

        };

        this.cancel = function () {
            this.dismiss();
        }
    }]
})
