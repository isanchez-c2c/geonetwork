(function() {
  goog.provide('gn_editor_controller');







































  goog.require('gn_directory_controller');
  goog.require('gn_editorboard_controller');
  goog.require('gn_fields');
  goog.require('gn_import_controller');
  goog.require('gn_mdactions_service');
  goog.require('gn_new_metadata_controller');
  goog.require('gn_scroll_spy');
  goog.require('gn_share');
  goog.require('gn_thesaurus');
  goog.require('gn_utility_directive');

  var module = angular.module('gn_editor_controller',
      ['gn_fields', 'gn_new_metadata_controller',
       'gn_import_controller',
       'gn_editorboard_controller', 'gn_share',
       'gn_directory_controller', 'gn_utility_directive',
       'gn_scroll_spy', 'gn_thesaurus', 'ui.bootstrap.datetimepicker',
       'ngRoute', 'gn_mdactions_service']);

  var tplFolder = '../../catalog/templates/editor/';

  module.config(['$routeProvider',
    function($routeProvider) {


      $routeProvider.
          when('/metadata/:id', {
            templateUrl: tplFolder + 'editor.html',
            controller: 'GnEditorController'}).
          when('/metadata/:id/tab/:tab', {
            templateUrl: tplFolder + 'editor.html',
            controller: 'GnEditorController'}).
          when('/metadata/:id/tab/:tab/:displayAttributes', {
            templateUrl: tplFolder + 'editor.html',
            controller: 'GnEditorController'}).
          when('/create', {
            templateUrl: tplFolder + 'new-metadata.html',
            controller: 'GnNewMetadataController'}).
          when('/create/from/:id/in/:group', {
            templateUrl: tplFolder + 'editor.html',
            controller: 'GnNewMetadataController'}).
          when('/create/from/:id/in/:group/tab/:tab', {
            templateUrl: tplFolder + 'editor.html',
            controller: 'GnNewMetadataController'}).
          when('/create/from/:id/in/:group/template/:template', {
            templateUrl: tplFolder + 'editor.html',
            controller: 'GnNewMetadataController'}).
          when('/directory', {
            templateUrl: tplFolder + 'directory.html',
            controller: 'GnDirectoryController'}).
          when('/directory/type/:type', {
            templateUrl: tplFolder + 'directory.html',
            controller: 'GnDirectoryController'}).
          when('/directory/id/:id', {
            templateUrl: tplFolder + 'directory.html',
            controller: 'GnDirectoryController'}).
          when('/import', {
            templateUrl: tplFolder + 'import.html',
            controller: 'GnImportController'}).
          otherwise({
            templateUrl: tplFolder + 'editorboard.html',
            controller: 'GnEditorBoardController'
          });
    }]);

  /**
   * Metadata editor controller - draft
   */
  module.controller('GnEditorController', [
    '$scope', '$routeParams', '$http', '$rootScope',
    '$translate', '$compile', '$timeout', '$location',
    'gnEditor', 'gnSearchManagerService',
    'gnConfigService', 'gnUtilityService',
    'gnCurrentEdit', 'gnConfig', 'gnMetadataActions',
    function($scope, $routeParams, $http, $rootScope, 
        $translate, $compile, $timeout, $location,
        gnEditor, gnSearchManagerService,
        gnConfigService, gnUtilityService,
        gnCurrentEdit, gnConfig, gnMetadataActions) {
      $scope.savedStatus = null;
      $scope.savedTime = null;
      $scope.formId = null;
      $scope.savedStatus = null;
      $scope.metadataFound = true;
      $scope.gnConfig = gnConfig;
      $scope.gnSchemaConfig = {};
      $scope.unsupportedSchema = false;

      /**
       * Animation duration for slide up/down
       */
      var duration = 300;

      /**
       * Function to call after form load
       * to move view menu to top toolbar
       */
      var setViewMenuInTopToolbar = function() {
        // Move view menu to the top toolbar
        var menu = $('.gn-view-menu-button');
        if (menu) {
          menu.empty();
          var button = $('#gn-view-menu-' + gnCurrentEdit.id);
          if (button) {
            menu.append(button);
          }
        }
      };
      // Controller initialization
      var init = function() {
        gnConfigService.load().then(function(c) {
          // Config loaded
          if ($routeParams.id) {
            // Check requested metadata exists
            gnSearchManagerService.gnSearch({
              _id: $routeParams.id,
              _content_type: 'json',
              _isTemplate: 'y or n or s',
              fast: 'index'
            }).then(function(data) {
              $scope.metadataFound = data.count !== '0';
              $scope.metadataNotFoundId = $routeParams.id;

              $scope.mdSchema = data.metadata[0]['geonet:info'].schema;
              $scope.mdCategories = [];
              var categories = data.metadata[0].category;
              if (categories) {
                if (angular.isArray(categories)) {
                  $scope.mdCategories = categories;
                } else {
                  $scope.mdCategories.push(categories);
                }
              }

              $scope.groupOwner = data.metadata[0].groupOwner;
              $scope.mdTitle = data.metadata[0].title ||
                  data.metadata[0].defaultTitle;

              if ($scope.mdSchema === 'fgdc-std' ||
                  $scope.mdSchema === 'iso19115') {
                $scope.unsupportedSchema = true;
                return;
              }

              // Set default schema configuration in case none is defined
              var config =
                  gnConfig['metadata.editor.schemaConfig'][$scope.mdSchema];
              if (!config) {
                config = {
                  displayToolTip: false
                };
              }
              // Get the schema configuration for the current record
              gnCurrentEdit.schemaConfig = $scope.gnSchemaConfig = config;



              var defaultTab = 'default';
              if (gnCurrentEdit.schemaConfig &&
                  gnCurrentEdit.schemaConfig.defaultTab) {
                defaultTab = gnCurrentEdit.schemaConfig.defaultTab;
              }

              if ($scope.metadataFound) {
                // TODO: Set metadata title in page HEAD ?
                $scope.layout.hideTopToolBar = true;

                angular.extend(gnCurrentEdit, {
                  id: $routeParams.id,
                  formId: '#gn-editor-' + $routeParams.id,
                  tab: $routeParams.tab || defaultTab,
                  displayAttributes: $routeParams.displayAttributes === 'true',
                  displayTooltips:
                      gnCurrentEdit.schemaConfig.displayToolTip === true,
                  compileScope: $scope,
                  formScope: $scope.$new(),
                  sessionStartTime: moment(),
                  formLoadExtraFn: setViewMenuInTopToolbar,
                  working: false
                });

                $scope.gnCurrentEdit = gnCurrentEdit;
                $scope.tocIndex = null;


                // Create URL for loading the metadata form
                // appending a random int in order to avoid
                // caching by route.
                $scope.editorFormUrl = gnEditor
                  .buildEditUrlPrefix('md.edit') + '&starteditingsession=yes&' +
                    '_random=' + Math.floor(Math.random() * 10000);

                window.onbeforeunload = function() {
                  // TODO: could be better to provide
                  // cancelAndClose and saveAndClose button
                  return $translate('beforeUnloadEditor',
                      {timeAgo: moment(gnCurrentEdit.savedTime).fromNow()});
                };
              }
            });
          }
        });
      };

      $scope.$watch('gnCurrentEdit.isMinor', function() {
        if ($('#minor')[0]) {
          $('#minor')[0].value = $scope.gnCurrentEdit.isMinor;
        }
      });

      /**
       * When the form is loaded, this function is called.
       * Use it to retrieve form variables or initialize
       * elements eg. tooltip ?
       */
      $scope.onFormLoad = function() {
        gnEditor.onFormLoad();
        $scope.isMinor = gnCurrentEdit.isMinor;
        $scope.$watch('tocIndex', function(newValue, oldValue) {
          if (angular.isDefined($scope.tocIndex) && $scope.tocIndex !== null) {
            $timeout(function() {
              $scope.switchToTab(gnCurrentEdit.tab);
            });
          }
        });
      };

      $scope.startVersioning = function() {
        return gnMetadataActions.startVersioning(gnCurrentEdit.id);
      };

      /**
       * Update the form according to the target tab
       * properties and save.
       */
      $scope.switchToTab = function(tabIdentifier, mode) {
        // Scroll top
        if (tabIdentifier !== $('#currTab')[0].value) {
          gnUtilityService.scrollTo();
        }

        $('#currTab')[0].value = tabIdentifier;
        $('#flat')[0].value = mode === 'flat';

        // Make the current form disapearing TODO: in save
        // Disable form + indicator ?
        //        $($scope.formId + ' > fieldset').fadeOut(duration);
        $scope.save(true);
      };

      /**
       * Set type of record. Update the matching form element.
       */
      $scope.setTemplate = function(isTemplate) {
        gnCurrentEdit.isTemplate = isTemplate ? 'y' : 'n';
        $('#template')[0].value = gnCurrentEdit.isTemplate;
      };
      $scope.isTemplate = function() {
        return gnCurrentEdit.isTemplate === 'y';
      };


      /**
       * Display or not attributes editor.
       *
       * if toggle is true, the current value is inverted.
       */
      $scope.toggleAttributes = function(toggle) {
        if (toggle) {
          gnCurrentEdit.displayAttributes =
              gnCurrentEdit.displayAttributes === false;
        }

        // Update the form to propagate info when saved
        // or tab switch - Needs to be propagated in Update service
        $('#displayAttributes')[0].value = gnCurrentEdit.displayAttributes;

        // Toggle class on all gn-attr widgets
        if (gnCurrentEdit.displayAttributes) {
          $('.gn-attr').removeClass('hidden');
        } else {
          $('.gn-attr').addClass('hidden');
        }
      };

      $scope.toggleTooltips = function(toggle) {
        if (toggle) {
          gnCurrentEdit.displayTooltips =
              gnCurrentEdit.displayTooltips === false;
        }

        // Update the form to propagate info when saved
        // or tab switch - Needs to be propagated in Update service
        $('#displayTooltips')[0].value = gnCurrentEdit.displayTooltips;
      };

      $scope.checkField = function(name) {
        return gnEditor[name].$error.required ? 'has-error' : '';
      };
      $scope.add = function(ref, name, insertRef, position, attribute) {
        if (attribute) {
          // save the form and add attribute
          // after save is done. When adding an attribute
          // the snippet returned contains the current field
          // and the newly created attributes.
          // Save to not lose current edits in main field.
          gnEditor.save(false)
            .then(function() {
                gnEditor.add(gnCurrentEdit.id, ref, name,
                    insertRef, position, attribute);
              });
        } else {
          gnEditor.add(gnCurrentEdit.id, ref, name,
              insertRef, position, attribute);
        }
        return false;
      };
      $scope.addChoice = function(ref, name, insertRef, position) {
        gnEditor.addChoice(gnCurrentEdit.id, ref, name,
            insertRef, position);
        return false;
      };
      $scope.remove = function(ref, parent, domRef) {
        gnEditor.remove(gnCurrentEdit.id, ref, parent, domRef);
        return false;
      };
      $scope.removeAttribute = function(ref) {
        gnEditor.removeAttribute(gnCurrentEdit.id, ref);
        return false;
      };
      $scope.switchTypeAndSave = function(refreshForm) {
        $scope.setTemplate(!$scope.isTemplate());
        return $scope.save(refreshForm);
      };
      $scope.save = function(refreshForm) {
        $scope.saveError = false;
        var promise = gnEditor.save(refreshForm)
          .then(function(form) {
              $scope.savedStatus = gnCurrentEdit.savedStatus;
              $scope.saveError = false;
              $scope.toggleAttributes();
            }, function(error) {
              $scope.savedStatus = gnCurrentEdit.savedStatus;
              $scope.saveError = true;
              $rootScope.$broadcast('StatusUpdated', {
                title: $translate('saveMetadataError'),
                error: error,
                timeout: 0,
                type: 'danger'});
            });
        $scope.savedStatus = gnCurrentEdit.savedStatus;
        return promise;
      };
      var closeEditor = function() {
        $scope.layout.hideTopToolBar = false;
        // Close the editor tab
        window.onbeforeunload = null;
        // Go to editor home
        $location.path('');
        // Tentative to close the browser tab
        window.close();
        // This last point may trigger
        // "Scripts may close only the windows that were opened by it."
        // when the editor was not opened by a script.
      };

      $scope.cancel = function(refreshForm) {
        $scope.savedStatus = gnCurrentEdit.savedStatus;
        return gnEditor.cancel(refreshForm)
          .then(function(form) {
              // Refresh editor form after cancel
              //  $scope.savedStatus = gnCurrentEdit.savedStatus;
              //  $rootScope.$broadcast('StatusUpdated', {
              //    title: $translate('cancelMetadataSuccess')
              //  });
              //  gnEditor.refreshEditorForm(null, true);
              closeEditor();
            }, function(error) {
              $scope.savedStatus = gnCurrentEdit.savedStatus;
              $rootScope.$broadcast('StatusUpdated', {
                title: $translate('cancelMetadataError'),
                error: error,
                timeout: 0,
                type: 'danger'});
            });
      };

      $scope.close = function() {
        var promise = gnEditor.save(false)
          .then(function(form) {
              closeEditor();
            }, function(error) {
              $rootScope.$broadcast('StatusUpdated', {
                title: $translate('saveMetadataError'),
                error: error,
                timeout: 0,
                type: 'danger'});
            });
        $scope.savedStatus = gnCurrentEdit.savedStatus;
        return promise;
      };
      $scope.getSaveStatus = function() {
        if (gnCurrentEdit.savedTime) {
          return $scope.saveStatus = $translate('saveAtimeAgo',
              {timeAgo: moment(gnCurrentEdit.savedTime).fromNow()});
        }
      };
      $scope.getCancelStatus = function() {
        if (gnCurrentEdit.sessionStartTime) {
          return $scope.cancelStatus =
              $translate('cancelChangesFromNow', {
                timeAgo: moment(gnCurrentEdit.sessionStartTime).fromNow()
              });
        }
      };

      $scope.$on('AddElement', function(event, ref, name,
          insertRef, position, attribute) {
            $scope.add(ref, name, insertRef, position, attribute);
          });

      $scope.validate = function() {
        $('#showvalidationerrors')[0].value = 'true';
        return $scope.save(true);
      };

      init();

    }]);

})();