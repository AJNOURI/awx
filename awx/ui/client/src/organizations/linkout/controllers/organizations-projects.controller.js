/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

export default ['$scope', '$rootScope', '$location', '$log',
    '$stateParams', 'Rest', 'Alert', 'Prompt',
    'ReturnToCaller', 'ClearScope', 'OrgProjectList', 'OrgProjectDataset',
    'ProcessErrors', 'GetBasePath', 'ProjectUpdate',
    'Wait', 'GetChoices', 'Empty', 'Find', 'GetProjectIcon', 'GetProjectToolTip', '$filter', '$state',
    function($scope, $rootScope, $location, $log, $stateParams, Rest, Alert, Prompt,
        ReturnToCaller, ClearScope, OrgProjectList, Dataset,
        ProcessErrors, GetBasePath, ProjectUpdate,
        Wait, GetChoices, Empty, Find, GetProjectIcon, GetProjectToolTip, $filter, $state) {

        var list = OrgProjectList,
            projUrl,
            choiceCount = 0,
            orgBase = GetBasePath('organizations'),
            projBase = GetBasePath('projects');

        init();

        function init() {
            // search init
            $scope.list = list;
            $scope[`${list.iterator}_dataset`] = Dataset.data;
            $scope[list.name] = $scope[`${list.iterator}_dataset`].results;

            $rootScope.flashMessage = null;

            $scope.$on('choicesReadyProjectList', function() {
                Wait('stop');
                if ($scope.projects) {
                    $scope.projects.forEach(function(project, i) {
                        $scope.projects[i].statusIcon = GetProjectIcon(project.status);
                        $scope.projects[i].statusTip = GetProjectToolTip(project.status);
                        $scope.projects[i].scm_update_tooltip = "Start an SCM update";
                        $scope.projects[i].scm_schedule_tooltip = "Schedule future SCM updates";
                        $scope.projects[i].scm_type_class = "";

                        if (project.status === 'failed' && project.summary_fields.last_update && project.summary_fields.last_update.status === 'canceled') {
                            $scope.projects[i].statusTip = 'Canceled. Click for details';
                        }

                        if (project.status === 'running' || project.status === 'updating') {
                            $scope.projects[i].scm_update_tooltip = "SCM update currently running";
                            $scope.projects[i].scm_type_class = "btn-disabled";
                        }

                        $scope.project_scm_type_options.forEach(function(type) {
                            if (type.value === project.scm_type) {
                                $scope.projects[i].scm_type = type.label;
                                if (type.label === 'Manual') {
                                    $scope.projects[i].scm_update_tooltip = 'Manual projects do not require an SCM update';
                                    $scope.projects[i].scm_schedule_tooltip = 'Manual projects do not require a schedule';
                                    $scope.projects[i].scm_type_class = 'btn-disabled';
                                    $scope.projects[i].statusTip = 'Not configured for SCM';
                                    $scope.projects[i].statusIcon = 'none';
                                }
                            }
                        });
                    });
                }
            });
        }

        $scope.$on(`${list.iterator}_options`, function(event, data){
            $scope.options = data.data.actions.GET;
            optionsRequestDataProcessing();
        });

        $scope.$watchCollection(`${$scope.list.name}`, function() {
                optionsRequestDataProcessing();
            }
        );

        // iterate over the list and add fields like type label, after the
        // OPTIONS request returns, or the list is sorted/paginated/searched
        function optionsRequestDataProcessing(){
            $scope[list.name].forEach(function(item, item_idx) {
                var itm = $scope[list.name][item_idx];

                // Set the item type label
                if (list.fields.scm_type && $scope.options &&
                        $scope.options.hasOwnProperty('scm_type')) {
                            $scope.options.scm_type.choices.forEach(function(choice) {
                                if (choice[0] === item.scm_type) {
                                itm.type_label = choice[1];
                            }
                        });
                    }

                    // buildTooltips(itm);

            });
        }

        // Go out and get the organization
        Rest.setUrl(orgBase + $stateParams.organization_id);
        Rest.get()
            .success(function(data) {
                $scope.organization_name = data.name;
                $scope.name = data.name;
                $scope.org_id = data.id;

                $scope.orgRelatedUrls = data.related;


               $scope.$on('ws-jobs', function(e, data) {
                    var project;
                    $log.debug(data);
                    if ($scope.projects) {
                        // Assuming we have a list of projects available
                        project = Find({ list: $scope.projects, key: 'id', val: data.project_id });
                        if (project) {
                            // And we found the affected project
                            $log.debug('Received event for project: ' + project.name);
                            $log.debug('Status changed to: ' + data.status);
                            if (data.status === 'successful' || data.status === 'failed') {
                                // @issue: OLD SEARCH
                                // $scope.search(list.iterator, null, null, null, null, false);

                            } else {
                                project.scm_update_tooltip = "SCM update currently running";
                                project.scm_type_class = "btn-disabled";
                            }
                            project.status = data.status;
                            project.statusIcon = GetProjectIcon(data.status);
                            project.statusTip = GetProjectToolTip(data.status);
                        }
                    }
                });

                if ($scope.removeChoicesHere) {
                    $scope.removeChoicesHere();
                }
                $scope.removeChoicesHere = $scope.$on('choicesCompleteProjectList', function() {

                    list.fields.scm_type.searchOptions = $scope.project_scm_type_options;
                    list.fields.status.searchOptions = $scope.project_status_options;

                    if ($stateParams.scm_type && $stateParams.status) {
                        // Request coming from home page. User wants all errors for an scm_type
                        projUrl += '?status=' + $stateParams.status;
                    }
                });

                if ($scope.removeChoicesReadyList) {
                    $scope.removeChoicesReadyList();
                }
                $scope.removeChoicesReadyList = $scope.$on('choicesReadyProjectList', function() {
                    choiceCount++;
                    if (choiceCount === 2) {
                        $scope.$emit('choicesCompleteProjectList');
                    }
                });

                // Load options for status --used in search
                GetChoices({
                    scope: $scope,
                    url: projBase,
                    field: 'status',
                    variable: 'project_status_options',
                    callback: 'choicesReadyProjectList'
                });

                // Load the list of options for Kind
                GetChoices({
                    scope: $scope,
                    url: projBase,
                    field: 'scm_type',
                    variable: 'project_scm_type_options',
                    callback: 'choicesReadyProjectList'
                });

            });

        $scope.editProject = function(id) {
            $state.go('projects.edit', { project_id: id });
        };

        if ($scope.removeGoToJobDetails) {
            $scope.removeGoToJobDetails();
        }
        $scope.removeGoToJobDetails = $scope.$on('GoToJobDetails', function(e, data) {
            if (data.summary_fields.current_update || data.summary_fields.last_update) {

                Wait('start');

                // Grab the id from summary_fields
                var id = (data.summary_fields.current_update) ? data.summary_fields.current_update.id : data.summary_fields.last_update.id;

                $state.go('scmUpdateStdout', { id: id });

            } else {
                Alert('No Updates Available', 'There is no SCM update information available for this project. An update has not yet been ' +
                    ' completed.  If you have not already done so, start an update for this project.', 'alert-info');
            }
        });

        $scope.showSCMStatus = function(id) {
            // Refresh the project list
            var project = Find({ list: $scope.projects, key: 'id', val: id });
            if (Empty(project.scm_type) || project.scm_type === 'Manual') {
                Alert('No SCM Configuration', 'The selected project is not configured for SCM. To configure for SCM, edit the project and provide SCM settings, ' +
                    'and then run an update.', 'alert-info');
            } else {
                // Refresh what we have in memory to insure we're accessing the most recent status record
                Rest.setUrl(project.url);
                Rest.get()
                    .success(function(data) {
                        $scope.$emit('GoToJobDetails', data);
                    })
                    .error(function(data, status) {
                        ProcessErrors($scope, data, status, null, {
                            hdr: 'Error!',
                            msg: 'Project lookup failed. GET returned: ' + status
                        });
                    });
            }
        };

        if ($scope.removeCancelUpdate) {
            $scope.removeCancelUpdate();
        }
        $scope.removeCancelUpdate = $scope.$on('Cancel_Update', function(e, url) {
            // Cancel the project update process
            Rest.setUrl(url);
            Rest.post()
                .success(function() {
                    Alert('SCM Update Cancel', 'Your request to cancel the update was submitted to the task manager.', 'alert-info');
                    $scope.refresh();
                })
                .error(function(data, status) {
                    ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Call to ' + url + ' failed. POST status: ' + status });
                });
        });

        if ($scope.removeCheckCancel) {
            $scope.removeCheckCancel();
        }
        $scope.removeCheckCancel = $scope.$on('Check_Cancel', function(e, data) {
            // Check that we 'can' cancel the update
            var url = data.related.cancel;
            Rest.setUrl(url);
            Rest.get()
                .success(function(data) {
                    if (data.can_cancel) {
                        $scope.$emit('Cancel_Update', url);
                    } else {
                        Alert('Cancel Not Allowed', '<div>Either you do not have access or the SCM update process completed. ' +
                            'Click the <em>Refresh</em> button to view the latest status.</div>', 'alert-info', null, null, null, null, true);
                    }
                })
                .error(function(data, status) {
                    ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Call to ' + url + ' failed. GET status: ' + status });
                });
        });

        $scope.cancelUpdate = function(id, name) {
            Rest.setUrl(GetBasePath("projects") + id);
            Rest.get()
                .success(function(data) {
                    if (data.related.current_update) {
                        Rest.setUrl(data.related.current_update);
                        Rest.get()
                            .success(function(data) {
                                $scope.$emit('Check_Cancel', data);
                            })
                            .error(function(data, status) {
                                ProcessErrors($scope, data, status, null, {
                                    hdr: 'Error!',
                                    msg: 'Call to ' + data.related.current_update + ' failed. GET status: ' + status
                                });
                            });
                    } else {
                        Alert('Update Not Found', '<div>An SCM update does not appear to be running for project: ' + $filter('sanitize')(name) + '. Click the <em>Refresh</em> ' +
                            'button to view the latest status.</div>', 'alert-info', undefined, undefined, undefined, undefined, true);
                    }
                })
                .error(function(data, status) {
                    ProcessErrors($scope, data, status, null, {
                        hdr: 'Error!',
                        msg: 'Call to get project failed. GET status: ' + status
                    });
                });
        };

        $scope.refresh = function() {
            // @issue: OLD SEARCH
            // $scope.search(list.iterator);
        };

        $scope.SCMUpdate = function(project_id, event) {
            try {
                $(event.target).tooltip('hide');
            } catch (e) {
                // ignore
            }
            $scope.projects.forEach(function(project) {
                if (project.id === project_id) {
                    if (project.scm_type === "Manual" || Empty(project.scm_type)) {
                        // Do not respond. Button appears greyed out as if it is disabled. Not disabled though, because we need mouse over event
                        // to work. So user can click, but we just won't do anything.
                        //Alert('Missing SCM Setup', 'Before running an SCM update, edit the project and provide the SCM access information.', 'alert-info');
                    } else if (project.status === 'updating' || project.status === 'running' || project.status === 'pending') {
                        // Alert('Update in Progress', 'The SCM update process is running. Use the Refresh button to monitor the status.', 'alert-info');
                    } else {
                        ProjectUpdate({ scope: $scope, project_id: project.id });
                    }
                }
            });
        };

        $scope.editSchedules = function(id) {
            var project = Find({ list: $scope.projects, key: 'id', val: id });
            if (!(project.scm_type === "Manual" || Empty(project.scm_type)) && !(project.status === 'updating' || project.status === 'running' || project.status === 'pending')) {
                $state.go('projectSchedules', { id: id });
            }
        };

        $scope.formCancel = function() {
            $state.go('organizations');
        };

    }
];
