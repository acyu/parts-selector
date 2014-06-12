'use strict';

var base_path = '/wpaeroflite/'; //uncomment this line for Alex cloud
// var base_path = '/' //uncomment this line for PROD

var underscore = angular.module('underscore', []);
underscore.factory('_', function() {
  return window._; // assumes underscore has already been loaded on the page
});

var app = angular.module('app',['ngRoute','partsSelectorCtrls','partsSelectorDirective','underscore']);

app.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/', {
        controller: 'ListPartsNumberCtrl',
        templateUrl: base_path + 'wp-content/plugins/parts-selector/app/partials/list-parts-numbers.html'
      }).
      when('/:base_part', {
        controller: 'BuildShellTypeCtrl',
        templateUrl: base_path + 'wp-content/plugins/parts-selector/app/partials/build-part-number.html'
      })
      .otherwise({redirecTo:'/'});
  }]);

var partsSelectorCtrls = angular.module('partsSelectorCtrls', ['ui.utils']);

partsSelectorCtrls.controller('ListPartsNumberCtrl', ['$scope','$http', '$parse', '$q',
  function($scope, $http, $parse, $q) {
    $scope.fn = {};
    $scope.data = {};
    $scope.data.accordions = {};
    $scope.action_ready = false;
    $http.get(base_path + 'wp-content/plugins/parts-selector/app/data/manufacturers_series.json').success(function(data) {
      $scope.data.manufacturers_series = data;
      var unique = '', unique_index = 0;
      angular.forEach(data, function(obj, key) {
        if(obj.manufacturer != unique) {
          var accordion_key = "data.accordions.accordion" + unique_index;
          var model = $parse(accordion_key);
          model.assign($scope,false);
          unique = obj.manufacturer;
          unique_index += 1;
        }
      });
    });

    $scope.fn.toggleListDisplay = function(index) {
      $scope.data.accordions['accordion' + index] = !$scope.data.accordions['accordion' + index];
    }

    $scope.filterByManufacturer = function(manufacturer) {
      return function(item) {
        if(item.manufacturer == manufacturer) return true;
      }
    };
  }]);

partsSelectorCtrls.controller('BuildShellTypeCtrl', ['$rootScope','$scope','$http', '$routeParams','$location', '$sce', '_', '$window',
  function($rootScope, $scope, $http, $routeParams, $location, $sce, _, $window) {
    $rootScope.window = $window;
    $scope.data = {},
    $scope.data.status_message = '';
    $scope.table = {},
    $scope.fn = {};
    $scope.data.original = {};
    $scope.data.breadcrumbs = [];
    $scope.data.part_number = {};
    $scope.data.final_part_number = '';
    $scope.data.static_part_field = {};
    $scope.data.descriptive_template = '';
    $scope.data.ignore = {};
    $scope.table.show_form = false;
    $scope.table.show_error = false;
    $scope.quote = {};
    $scope.quote.base_part = '';
    $scope.quote.unit = '';
    $scope.quote.quantity = '';
    $scope.quote.target_price = '';
    $scope.quote.required_date = '';
    $scope.quote.comments = '';
    $scope.quote.product_id = '';

    $scope.quote.base_part = $routeParams.base_part;

    $http.get(base_path + 'wp-content/plugins/parts-selector/app/data/manufacturers_series.json').success(function(data) {
      var stop = false;
      angular.forEach(data, function(obj, key) {
        if(!stop) {
          if(obj.series == $routeParams.base_part) {
            $scope.data.breadcrumbs.push(obj.manufacturer);
            $scope.data.breadcrumbs.push(obj.description);
            stop = true;
          }
        }
      });
    });

    $http.get(base_path + 'wp-content/plugins/parts-selector/app/data/' + $routeParams.base_part + '.json').success(function(data) {
      $scope.data.database = data;
      $scope.table.columns = [];
      angular.forEach($scope.data.database, function(obj, key) {
        //exclude: has dropdown select option but for display only
        //ignore: don't have dropdown select option but use to compute part number
        if(!obj.hasOwnProperty('ignore')) {
        $scope.data.original[key] = angular.copy(obj);
        obj.key = key;
        obj.visible = true;
        //if(obj.key == 'insert') {
          //obj.data = _.uniq(_.sortBy(obj.data, function(val) { return val; }));
          //console.log(obj.data);
        //}
        $scope.data.part_number[key] = '';
        //if(typeof obj.dependency === 'undefined') $scope.data.part_number[key] = '';
        /*if(obj.dependency && obj.dependency != '') {
          $scope.data.static_part_field[key] = {};
          $scope.data.static_part_field[key].data = 'Select with Insert Pattern';
          $scope.data.static_part_field[key].showedit = false;
        }*/
        //if(key == 'base' && obj.data.length == 1) $scope.data.part_number[key] = obj.data[0];
        if(obj.data.length == 1) $scope.data.part_number[key] = obj.data[0];
        obj.skip = false;
        if(obj.data.length == 1) obj.skip = true;
        if(obj.label) {
          obj.label = $sce.trustAsHtml(obj.label);
        }

        if($scope.table.columns.length == 0)
          obj.disabled = false; //allow first option
        else
          obj.disabled = true;

        $scope.table.columns.push(obj);

        } else { //check ignore
          $scope.data.ignore[key] = obj;
        }
      });
    }).then(function(data) {
      var stop = false;
      angular.forEach($scope.data.part_number, function(obj, key) {
        if(!stop) {
          var current_column = _.find($scope.table.columns, function (column) { return key === column.key; });
          current_column.disabled = false;
          if(obj == '') {
            /*$http.get(base_path + 'wp-content/plugins/parts-selector/app/data/descriptive_templates/' + $routeParams.base_part + '_' + key + '.html').success(function(data) {
              $scope.data.descriptive_template = $sce.trustAsHtml(data);
            }).error(function(data, status, headers, config) {*/
              var output = '<div class="clearfix">' + $scope.fn.build_meta_data(key) + '</div>';
              $scope.data.descriptive_template = $sce.trustAsHtml(output);
            //});
            stop = true;
          }
        }
      });
    });

    $scope.fn.editPartNumber = function() {
      $location.path('/');
    };

    $scope.fn.select_update = function(key) {
      var form_ready = true, loopindex = 0, stop = false, product_id = '';
      $scope.table.show_error = false;
      $scope.data.status_message = '';

      //reset value of fields that follows the current field
      var found_key = false;
      var found_skip = false;
      angular.forEach($scope.data.part_number, function(value, part_number_key) {
        var column = _.find($scope.table.columns, function (column) { return part_number_key === column.key; });
        if(part_number_key == key) found_key = true;
        if(found_key && part_number_key != key && !column.skip && !column.hidden) {
          $scope.data.part_number[part_number_key] = '';
          column.disabled = true;
          if(part_number_key == 'insert_arrangement') {
            angular.forEach($scope.data.static_part_field, function(static_field, field_key) {
              static_field.data = 'Select with Insert Pattern';
              static_field.showedit = false;
            });
            column.visible = true;
          }
        }
      });

      //build part number
      $scope.data.final_part_number = '';
      angular.forEach($scope.data.part_number, function(value, part_number_key) {
        if(!stop) {
          if(!value) { stop = true; }
          else {
            var part_number_column = _.find($scope.table.columns, function (column) { return part_number_key === column.key; });
            if(typeof part_number_column.exclude === 'undefined') {
              //basically test for insert arrangement
              if(part_number_key == 'insert_arrangement') {
                $scope.data.final_part_number += Object.keys(JSON.parse(value))[0];
              } else {
                if(value == '[blank]') value = '';
                $scope.data.final_part_number += value;
              }
            }
          }
        }
      });
      //console.log($scope.data.final_part_number);

      //validate product number per field
      $http.get(base_path  + '?check_product_parts=' + $scope.data.final_part_number).success(function(response) {
        if(response == true) {
          stop = false;
          angular.forEach($scope.data.part_number, function(part_number, part_number_key) {
            if(!stop) {
              var column = _.find($scope.table.columns, function (column) { return part_number_key === column.key; });
              column.disabled = false;
              if(column.data.length == 1) $scope.data.part_number[part_number_key] = part_number = column.data[0];
              if(part_number == '')  {
                /*$http.get(base_path + 'wp-content/plugins/parts-selector/app/data/descriptive_templates/' + $routeParams.base_part + '_' + part_number_key + '.html').success(function(data) {
                  $scope.data.descriptive_template = $sce.trustAsHtml(data);
                }).error(function(data, status, headers, config) {*/
                  //$scope.fn.build_meta_data(part_number_key);
                  var output = '<div class="clearfix">' + $scope.fn.build_meta_data(part_number_key) + '</div>';
                  $scope.data.descriptive_template = $sce.trustAsHtml(output);
                //});
                stop = true;
              }
            }
          });
        } else {
          var column = _.find($scope.table.columns, function (column) { return key === column.key; });
          $scope.data.status_message = 'The combination you selected does not exist, please modify your ' + column.label + ' selection and try again.';
        }
      });

      //check if all part variable has been filled, if not set form ready var to false
      angular.forEach($scope.data.part_number, function(part_number, index) {
        if(form_ready) {
          if(part_number == '') {
            $scope.table.show_form = false;
            form_ready = false;
          }
          loopindex += 1;
        }
      });

      //check if part number returns product id (should, we already validated before) show form when valid id is returned
      if(form_ready && (Object.keys($scope.data.part_number).length == loopindex)) {
        $http.get(base_path  + '?get_part_number_id=' + $scope.data.final_part_number).success(function(response) {
          if(response != '' && typeof parseInt(response) === 'number' && parseInt(response) != NaN) {
            $scope.quote.product_id = response; //$scope.data.final_part_number;
            $scope.table.show_form = true;
            $scope.data.descriptive_template = '';
          } else {
            $scope.table.show_form = false;
            var column = $scope.table.columns[$scope.table.columns.length-1];
            $scope.data.status_message = 'The combination you selected does not exist, please modify your ' + column.label + ' selection and try again.';
          }
        });
      }

      //if change is insert_arrangment field, parse the main object value and display the subset value
      if(key == 'insert_arrangement') {
        if($scope.data.part_number[key]) {
          var insert_arrangement = JSON.parse($scope.data.part_number[key]);
          for(var topkey in insert_arrangement) {
            for(var subkey in insert_arrangement[topkey]) {
              $scope.data.static_part_field[subkey] = {};
              $scope.data.static_part_field[subkey].data = insert_arrangement[topkey][subkey];
              $scope.data.static_part_field[subkey].showedit = true;
            }
          }
          angular.forEach($scope.table.columns, function(column, column_key) {
            if(column.key == key) { column.visible = false; }
          });
        } else {
          angular.forEach($scope.data.static_part_field, function(obj,obj_key) {
            $scope.data.static_part_field[obj_key].data = 'Select with Insert Pattern';
            $scope.data.static_part_field[obj_key].showedit = false;
          });
        }
      }

      /**
       * deal with field value exception
       */
       //console.log('show form');
       //console.log($scope.table.show_form);
       //console.log(form_ready);
      if(!form_ready) {
      angular.forEach($scope.table.columns, function(column, index) {
        if(typeof column.exception != 'undefined') {
          angular.forEach(column.exception.fields, function(field, keyId) {
            if(key == field) {
              var selectedData = $scope.data.part_number[key];
              var exception = _(column.exception.actions).reject(function(action) {
                return action.triggers.indexOf(selectedData) < 0;
              });
              if(exception.length > 0) {
                $scope.fn.filter_exception(column, exception);
              } else {
                column.data = angular.copy($scope.data.original[column.key].data);
                /*$http.get(base_path + 'wp-content/plugins/parts-selector/app/data/' + $routeParams.base_part + '.json').success(function(response) {
                  column.data = response[column.key].data;
                });*/
              }
              //to make sure exception field behave correctly, let's reset the field value when exception triggers

              /*if(column.data.length == 1) {
                $scope.data.part_number[column.key] = column.data[0];
                $scope.fn.select_update(column.key);
              } else {
                $scope.data.part_number[column.key] = '';
              }*/

              /*var selectedData = $scope.data.part_number[key];
              var exception = _(column.exception.actions).reject(function(action) {
                return action.triggers.indexOf(selectedData) < 0;
              });
              if(exception.length > 0) {
                $http.get(base_path + 'wp-content/plugins/parts-selector/app/data/' + $routeParams.base_part + '.json').success(function(response) {
                  column.data = response[column.key].data;
                  var filtered_data = [];
                  if(exception[0].hasOwnProperty('remove')) {
                    filtered_data = _.without.apply(_, [column.data].concat(exception[0]['remove']));
                  } else if(exception[0].hasOwnProperty('keep')) {
                    filtered_data = _.intersection(column.data,exception[0]['keep']);
                  }

                  column.data = filtered_data;
                  //to make sure exception field behave correctly, let's reset the field value when exception triggers
                  if(column.data.length == 1) {
                    $scope.data.part_number[column.key] = column.data[0];
                    $scope.fn.select_update(column.key);
                  } else {
                    $scope.data.part_number[column.key] = '';
                  }
                });*/
              }/* else {
                $http.get(base_path + 'wp-content/plugins/parts-selector/app/data/' + $routeParams.base_part + '.json').success(function(response) {
                  console.log(column.key);
                  column.data = response[column.key].data;
                });
              }*/
          });
        }
      });
      } // check form is ready end
    };

    //need to rewrite this with promise
    $scope.fn.filter_exception = function(column, exception, filtered_data) {
      if(exception.length > 0) {
        if(typeof filtered_data === 'undefined') {
          //$http.get(base_path + 'wp-content/plugins/parts-selector/app/data/' + $routeParams.base_part + '.json').success(function(response) {
            //var original_data = response[column.key].data;
            var original_data = angular.copy($scope.data.original[column.key].data);
            filtered_data = [];
            if(exception[0].hasOwnProperty('remove')) {
              filtered_data = _.without.apply(_, [original_data].concat(exception[0]['remove']));
            } else if(exception[0].hasOwnProperty('keep')) {
              filtered_data = _.intersection(original_data,exception[0]['keep']);
            } else {
              filtered_data = original_data;
            }

            if(exception[0].hasOwnProperty('exception')) {
              var exceptionSelectedData = $scope.data.part_number[exception[0]['exception']['fields'][0]];
              var subException = _(exception[0]['exception']['actions']).reject(function(action) {
                return action.triggers.indexOf(exceptionSelectedData) < 0;
              });

              if(subException.length > 0) {
                $scope.fn.filter_exception(column, exception[0]['exception']['actions'], filtered_data);
              } else {
                column.data = filtered_data;
                if(column.data.length == 1) {
                  $scope.data.part_number[column.key] = column.data[0];
                  $scope.fn.select_update(column.key);
                } else {
                  $scope.data.part_number[column.key] = '';
                }
              }
            } else {
              column.data = filtered_data;
              if(column.data.length == 1) {
                $scope.data.part_number[column.key] = column.data[0];
                $scope.fn.select_update(column.key);
              } else {
                $scope.data.part_number[column.key] = '';
              }
            }
          //});
        } else {
          if(exception[0].hasOwnProperty('remove')) {
            column.data = _.without.apply(_, [filtered_data].concat(exception[0]['remove']));
            if(column.data.length == 1) {
              $scope.data.part_number[column.key] = column.data[0];
              $scope.fn.select_update(column.key);
            } else {
              $scope.data.part_number[column.key] = '';
            }
          }
        }
      } else {
        column.data = angular.copy($scope.data.original[column.key].data);
        /*$http.get(base_path + 'wp-content/plugins/parts-selector/app/data/' + $routeParams.base_part + '.json').success(function(response) {
          column.data = response[column.key].data;
        });*/
      }
      //return filtered_data;
    }

    /* should move to directive */
    $scope.fn.build_meta_data = function(key) {
      var found = false;
      var output = '';
      angular.forEach($scope.table.columns, function(column, column_key) {
      if(!found) {
        if(key == column.key) {
          if(key != 'insert_arrangement') {
            output = '<table style="float: left;"><tr><th>'+ column.label +'</th><th></th></tr>';
            angular.forEach(column.data, function(item, item_key) {
              output += '<tr>';
              if(item == '[blank]') item = 'Blank value';
              output += '<td>' + item + '</td><td>';
              if(column.hasOwnProperty('description')) {
                output += column.description[item_key];
              }
              output +=  '</td>';
              output += '</tr>';
            });
            output += '</table>';
          } else {
            output = '<table style="float: left;">';
            angular.forEach(column.data, function(column, column_key) {
              var obj_key = Object.keys(column)[0];
              var insert_arrangement = Object.keys(column[obj_key]);
              if(column_key == 0) {
                output += '<tr>';
                angular.forEach(insert_arrangement, function(arrangement, index) {
                  var header_label = '';
                  angular.forEach($scope.table.columns, function(header, index) {
                    if(header.key == arrangement) header_label = header.label;
                  });
                  if(header_label) {
                    output += '<td>' + header_label + '</td>';
                  } else {
                    output += '<td>' + arrangement + '</td>';
                  }
                });
                output += '</tr>';
              }
              output += '<tr>';
              angular.forEach(insert_arrangement, function(arrangement, index) {
                output += '<td>' + column[obj_key][arrangement] + '</td>';
              });
              output += '<tr>';
            });
            output += '</table>';

            if(column.hasOwnProperty('description')) {
              var dependent_field = column.description['dependency'];
              output += $scope.fn.build_meta_data(dependent_field);
            }
          }
          found = true;
        }
      }
      });

      return output;
    }

    $scope.fn.editInsertPattern = function() {
      angular.forEach($scope.data.static_part_field, function(obj,key) {
        $scope.data.static_part_field[key].data = 'Select with Insert Pattern';
        $scope.data.static_part_field[key].showedit = false;
        $scope.data.part_number['insert_arrangement'] = '';
        angular.forEach($scope.table.columns, function(column, key) {
            if(column.key == 'insert_arrangement') column.visible = true;
        });
      });
      $scope.fn.select_update('insert_arrangement');
    }

    $scope.fn.redirect = function(path) {
      $location.path(path);
    }
}]);

var partsSelectorDirective = angular.module('partsSelectorDirective', []);

partsSelectorDirective.directive('selectOption', function() {
  return {
    restrict: 'A',
    replace: true,
    scope: {
      data: '='
    },
    template: '<option value="{{option_value}}">{{option_label}}</option>',
    link: function (scope, elem, attrs) {
      scope.option_value = '', scope.option_label = '';
      if(angular.isObject(scope.data)) {
        scope.option_label = Object.keys(scope.data)[0];
        scope.option_value = scope.data;
        if(Object.keys(scope.data)[0] == '[blank]') scope.option_label = '';
      } else {
        scope.option_value = scope.option_label = scope.data;
        if(scope.data == '[blank]') scope.option_label = '';
      }
    }
  }
});

partsSelectorDirective.directive('datepicker', function() {
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      elem.datepicker();
    }
  }
});

partsSelectorDirective.directive('descriptionTemplate', function($compile) {
  return {
    restrict: 'A',
    replace: true,
    scope: {
      ngModel: '='
    },
    link: function(scope, elem, attrs) {
      if(scope.ngModel.template != '') {
        elem.html(scope.ngModel.template);
      } else {
        elem.html(scope.ngModel.description);
      }
      $compile(elem.contents())(scope);
    }
  }
});
