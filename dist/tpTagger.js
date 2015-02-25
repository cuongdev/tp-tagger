angular.module("tpTagger").run(["$templateCache", function($templateCache) {$templateCache.put("tp_tagger.tpl.html","<div ng-click=\"setFocus = true\"><div class=\"tp-tagger-error-texts\" ng-show=\"hasError\"><span ng-show=\"uniqueError\">{{options.errors.notUniqueTag}}</span></div><div class=\"tp-tagger\"><div class=\"tp-tags-wrapper\"><div class=\"tp-tags\"><span class=\"tp-tag\" ng-repeat=\"tag in selectedTags track by $index\">{{ tag }}<span class=\"delete\" ng-click=\"deleteTag($index)\"><i class=\"fa fa-times\"></i></span></span> <input tp-tagger-input=\"\" ng-change=\"changeInput()\" type=\"text\" class=\"input input-text tp-tag-input\" placeholder=\"{{options.placeholderText}}\" ng-focus=\"hasFocus = true\" ng-blur=\"hasFocus = false\" tp-focus=\"setFocus\" ng-model=\"searchTag\"></div></div><div class=\"tp-btn-wrapper\"><button class=\"btn btn-primary btn-add\" ng-click=\"addTag(searchTag)\" ng-if=\"options.addBtnActive\"><i class=\"fa fa-plus\"></i></button> <button class=\"btn btn-primary btn-search\" ng-click=\"search(options.searchFunction)\" ng-if=\"options.searchFunction\" ng-disabled=\"searching\"><span ng-hide=\"searching\"><i class=\"fa fa-search\"></i></span> <span ng-show=\"searching\"><i class=\"fa fa-spinner fa-pulse\"></i></span></button></div></div><div tp-tagger-popup=\"\"></div></div>");
$templateCache.put("tp_tagger_popup.tpl.html","<div class=\"tp-tagger-suggestions\" ng-show=\"isSuggestionsVisible\"><ul><li ng-repeat=\"suggestion in suggestions\" ng-class=\"{active: isActive($index) }\" ng-mouseenter=\"selectActive($index)\"><div class=\"tp-text\">{{suggestion}}</div><div class=\"tp-break\" ng-if=\"!$last\"></div></li></ul></div>");}]);
'use strict';

/**
 * Created by rucs3n on 2015/01/15.
 */

angular.module('tpTagger', [])
  .directive('tpTagger', ["$timeout", "$filter", "$log", function($timeout, $filter, $log) {
    return {
      restrict: 'AE',
      templateUrl: 'tp_tagger.tpl.html',
      scope: {
        options: '='
      },
      controller: ["$scope", function($scope) {
        $scope.hasFocus = false;
        $scope.isSuggestionsVisible = false;
        $scope.suggestions = [];
        $scope.searchTag = '';
        $scope.searching = false;
        $scope.selectedSuggestionIndex = -1;
        $scope.uniqueError = false;
        $scope.hasError = false;

        var setError = function(errorName, state) {
          //it is only possible to show one error
          $scope[errorName] = state;
          $scope.hasError = state;
        };

        $scope.addTag = function(tag) {
          if ((!$scope.options.uniqueTags || $scope.selectedLowerTags.indexOf(tag.toLowerCase()) === -1) && tag !== '') {
            $scope.selectedTags.push(tag);
            $scope.selectedLowerTags.push(tag.toLowerCase());
            $scope.searchTag = '';
          } else if(tag !== ''){
            $log.info('tag not unique');
            setError('uniqueError', true);
            $scope.searchTag = '';
          } else {
            $log.info('tag empty');
          }
        };

        $scope.deleteTag = function(index) {
          $scope.selectedTags.splice(index, 1);
          $scope.selectedLowerTags.splice(index, 1);
        };

        //the supplied search method must return a promise to indicate finish of loading
        $scope.search = function(callback) {
          if ($scope.selectedTags.length >= 1) {
            $scope.searching = true;
            callback($scope.selectedTags).then(function() {
              $log.debug('finshed searching');
              $scope.searching = false;
            }, function(reason) {
              $log.error(reason);
              $scope.searching = false;
            });
          }
        };

        $scope.isActive = function(index) {
          return index === $scope.selectedSuggestionIndex;
        };

        $scope.selectActive = function(index) {
          $scope.selectedSuggestionIndex = index;
        };

        $scope.changeInput = function() {
          $log.info($scope.searchTag);
          if ($scope.searchTag.length > $scope.options.minChar) {
            $scope.suggestions = $filter('filter')($scope.dictionary, $scope.searchTag) || [];
            $scope.suggestions = $scope.suggestions.slice(0, $scope.options.maxResults);
            //check if suggestions view should be open
            if ($scope.suggestions.length >= 1) {
              $scope.changeSuggestionVisible(true);
            } else {
              $scope.changeSuggestionVisible(false);
            }

            //$scope.$digest();
          } else {
            if ($scope.isSuggestionsVisible) {
              $scope.changeSuggestionVisible(false);
              //scope.$digest();
            }
          }

          $scope.resetErrors();
        };


        $scope.changeSuggestionVisible = function(visible) {
          if (visible) {
            $scope.isSuggestionsVisible = true;
          } else {
            $scope.selectedSuggestionIndex = -1;
            $scope.selectedSuggestion = undefined;
            $scope.isSuggestionsVisible = false;
          }
        };

        $scope.resetErrors = function() {
          if($scope.hasError) {
            $log.debug('reset errors');
            $scope.uniqueError = false;
            $scope.hasError = false;
          }
        };
      }],
      link: function(scope) {
        //SUPPORTED OPTIONS (OPTIONS)
        scope.options = scope.options || {};
        //minimal no of characters that needs to be entered before typeahead kicks-in
        scope.options.minChar = scope.options.minChar || 1;
        scope.options.maxResults = scope.options.maxResults || 10;
        //array of preselected Tags
        scope.selectedTags = scope.options.selectedTags || [];
        scope.selectedLowerTags = [];
        //copy lower case version to seperate array
        for(var i=0; i<scope.selectedTags.length; i++) {
          scope.selectedLowerTags.push(scope.selectedTags[i].toLowerCase());
        }
        //array of tag to search for suggestions
        scope.dictionary = scope.options.dictionary || [];
        //should the user only be able to add a tag once
        scope.options.uniqueTags = scope.options.uniqueTags || true;
        //custom error message can be provided
        scope.options.errors = scope.options.errors || {
          notUniqueTag: 'The tag which you tried to add is not unique. You may only add a Tag once.'
        };
      }
    };
  }])
  .directive('tpTaggerInput', ["$log", function($log) {
    //arrows up(38) / down(40), enter(13) and tab(9), esc(27), ctrl(17), s(83)
    var HOT_KEYS = [8, 9, 13, 17, 27];
    var HOT_KEYS_SUGGESTION = [38, 40];
    return {
      restrict: 'A',
      require: '^ngModel',
      link: function(scope, element) {
        var mapOfKeyStrokes = {};

        element.bind('blur', function() {
          if (scope.searchTag.length > 0 && scope.selectedSuggestionIndex < 0) {
            //add the input
            scope.addTag(scope.searchTag);
          } else if (scope.selectedSuggestionIndex >= 0) {
            scope.addTag(scope.suggestions[scope.selectedSuggestionIndex]);
          } else {
            scope.resetErrors();
          }

          scope.changeSuggestionVisible(false);
        });

        //bind keyboard events: arrows up(38) / down(40), enter(13) and tab(9), esc(27), ctrl(17), s(83), remove(8)
        element.bind('keydown', function(evt) {
          $log.info(evt.which);
            //typeahead is open and an "interesting" key was pressed
          if ((!scope.isSuggestionsVisible || HOT_KEYS_SUGGESTION.indexOf(evt.which) === -1) && HOT_KEYS.indexOf(evt.which) === -1) {
            if (!(mapOfKeyStrokes[17] && evt.which === 83)) {
              $log.debug('not important key pressed');
              mapOfKeyStrokes = {};
              return;
            }
          } else if (evt.which === 8 && scope.searchTag !== '') {
            mapOfKeyStrokes = {};
            return;
          }

          evt.preventDefault();

          var e = e || event; // to deal with IE
          mapOfKeyStrokes[evt.which] = e.type === 'keydown';

          //if enter or tab is pressed add the selected suggestion or the value entered to the
          //selectedTags array
          if (mapOfKeyStrokes[13] || mapOfKeyStrokes[9]) {
            if (scope.selectedSuggestion) {
              //add the selected tag
              scope.addTag(scope.selectedSuggestion);
            } else if (scope.searchTag.length > 0) {
              //add the input
              scope.addTag(scope.searchTag);
            } else if (scope.options.searchFunction && scope.selectedTags.length > 0) {
              //if a search function is provided and at least one tag was added  -> search
              scope.search(scope.options.searchFunction);
            }

            scope.changeSuggestionVisible(false);

            scope.$digest();
            //do nothing if no suggestion is selected or the entered text has not more than 2 characters
            mapOfKeyStrokes = {};
          }

          // if the combination of Ctrl + s is pressed execute a search
          else if (mapOfKeyStrokes[17] && mapOfKeyStrokes[83]) {
            $log.info('Search for tags');
            evt.preventDefault();
            if (scope.options.searchFunction) {
              scope.search(scope.options.searchFunction);
            }
            mapOfKeyStrokes = {};
          }

          //if escape is pressed close the suggestion view and set selected suggestion to undefined
          else if (mapOfKeyStrokes[27]) {
            scope.changeSuggestionVisible(false);
            scope.$digest();
            mapOfKeyStrokes = {};
          } else if (mapOfKeyStrokes[40]) { //arrow down -> typeahead selected one down
            if (scope.isSuggestionsVisible) {
              if (scope.selectedSuggestionIndex < scope.suggestions.length - 1 && scope.selectedSuggestionIndex >= 0) {
                scope.selectedSuggestionIndex = scope.selectedSuggestionIndex + 1;
              } else {
                scope.selectedSuggestionIndex = 0;
              }

              scope.selectedSuggestion = scope.suggestions[scope.selectedSuggestionIndex];
              scope.$digest();
            }

            mapOfKeyStrokes = {};
          } else if (mapOfKeyStrokes[8] && scope.searchTag === '' && scope.selectedTags.length > 0) {
            scope.deleteTag(scope.selectedTags.length - 1);
            mapOfKeyStrokes = {};
            scope.$digest();
          } else if (mapOfKeyStrokes[38]) { //arrow up -> set typeahead selected on up
            if (scope.isSuggestionsVisible) {
              if (scope.selectedSuggestionIndex > 0) {
                scope.selectedSuggestionIndex = scope.selectedSuggestionIndex - 1;
              } else {
                scope.selectedSuggestionIndex = scope.suggestions.length - 1;
              }

              scope.selectedSuggestion = scope.suggestions[scope.selectedSuggestionIndex];
              scope.$digest();
            }

            mapOfKeyStrokes = {};
          } else {
            if (!mapOfKeyStrokes[17]) {
              mapOfKeyStrokes = {};
            }
          }
        });
      }
    };
  }])
  .directive('tpTaggerPopup', function() {
    return {
      restrict: 'A',
      replace: true,
      templateUrl: 'tp_tagger_popup.tpl.html'
    };
  }).directive('tpFocus', ["$timeout", "$parse", function($timeout, $parse) {
    return {
      link: function(scope, element, attrs) {
        var model = $parse(attrs.tpFocus);
        scope.$watch(model, function(value) {
          if (value === true) {
            $timeout(function() {
              element[0].focus();
            });
          }
        });
        element.bind('blur', function() {
          scope.$apply(model.assign(scope, false));
        });
      }
    };
  }]);