angular.module('web')
  .controller('loginCtrl', ['$scope', '$rootScope', '$translate', 'Auth', 'AuthInfo', '$timeout', '$location', 'Const', 'Dialog', 'Toast', 'Cipher', 'settingsSvs',
    function ($scope, $rootScope, $translate, Auth, AuthInfo, $timeout, $location, Const, Dialog, Toast, Cipher, settingsSvs) {

      var DEF_EP_TPL = 'https://{region}.aliyuncs.com';

      var KEY_REMEMBER = Const.KEY_REMEMBER;
      var SHOW_HIS = Const.SHOW_HIS;
      var SHOW_REQUEST_PAY = Const.SHOW_REQUEST_PAY;
      var KEY_AUTHTOKEN = 'key-authtoken';
      var regions = angular.copy(Const.regions);

      var T = $translate.instant;

      angular.extend($scope, {
        gtab: parseInt(localStorage.getItem('gtag') || 1),
        flags: {
          remember: 'NO',
          showHis: 'NO',
          requestpaystatus: 'NO'
        },
        item: {
          eptpl: DEF_EP_TPL,
        },
        eptplType: 'default',

        hideTopNav: 1,
        reg_osspath: /^oss\:\/\//,
        regions: regions,
        onSubmit: onSubmit,
        showCleanHistories: showCleanHistories,
        useHis: useHis,
        showRemoveHis: showRemoveHis,

        open: open,

        onSubmit2: onSubmit2,
        authTokenChange: authTokenChange,

        eptplChange: eptplChange,
      });

      $scope.$watch('item.eptpl', function (v) {
        $scope.eptplType = (v == DEF_EP_TPL) ? 'default' : 'customize';
      });

      // $scope.$watch('item.eptpl', function(v){
      //     // $scope.eptplType = (v==DEF_EP_TPL)?'default':'customize';
      // });

      $scope.$watch('gtab', function (v) {
        localStorage.setItem('gtag', v)
      });

      $scope.$watch('item.cname', function (v) {
        console.log('cname: ' + v)
        if (v) {
          $scope.eptplType = 'cname'
        }
      });

      function eptplChange(t) {
        $scope.eptplType = t;
        //console.log(t);
        if (t == 'default') {
          $scope.item.eptpl = DEF_EP_TPL;
          $scope.item.cname = false;
        } else if (t == 'customize') {
          $scope.item.cname = false;
          $scope.item.eptpl = '';
        } else if (t == 'cname') {
          $scope.item.cname = true;
          $scope.item.eptplcname = '';
        }
      }

      function open(a) {
        openExternal(a);
      }

      var tid;

      function authTokenChange() {
        $timeout.cancel(tid);
        tid = $timeout(function () {
          var authToken = $scope.item.authToken || '';

          localStorage.setItem(KEY_AUTHTOKEN, authToken);

          if (!authToken) {
            $scope.authTokenInfo = null;
            return;
          }

          try {
            var str = Buffer.from(authToken, 'base64').toString();
            var info = JSON.parse(str);

            if (info.id && info.secret && info.stoken && info.privilege && info.expiration && info.osspath) {

              //??????
              try {
                var d = new Date(info.expiration).getTime();
                info.isExpired = d <= new Date().getTime();
              } catch (e) {

              }
              $scope.authTokenInfo = info;

              $scope.authTokenInfo.expirationStr = moment(new Date(info.expiration)).format('YYYY-MM-DD HH:mm:ss');

            }
            else if (info.id && info.secret && !info.id.startsWith('STS.')) {
              //?????????ak
              $scope.authTokenInfo = info;
            }
            else if (new Date(info.expiration).getTime() < new Date().getTime()) {
              $scope.authTokenInfo = null;
            }
          } catch (e) {
            $scope.authTokenInfo = null;
          }
        }, 600);
      }

      init();

      function init() {
        $scope.flags.remember = localStorage.getItem(KEY_REMEMBER) || 'NO';
        $scope.flags.showHis = localStorage.getItem(SHOW_HIS) || 'NO';

        //requestPay??????
        $scope.flags.requestpaystatus = localStorage.getItem(SHOW_REQUEST_PAY) || 'NO';
        angular.extend($scope.item, AuthInfo.getRemember());


        //??????token
        $scope.item.authToken = localStorage.getItem(KEY_AUTHTOKEN) || '';
        authTokenChange();

        listHistories();

        $scope.$watch('flags.remember', function (v) {
          if (v == 'NO') {
            AuthInfo.unremember();
            localStorage.setItem(KEY_REMEMBER, 'NO');
          }
        });

        $scope.$watch('flags.showHis', function (v) {
          localStorage.setItem(SHOW_HIS, v);
        });

        $scope.$watch('flags.requestpaystatus', function (v) {
          console.log(v)
          localStorage.setItem(SHOW_REQUEST_PAY, v);
        });
      }

      function useHis(h) {
        if (h.cname) {
          $scope.eptplType = 'cname'
        }
        angular.extend($scope.item, h);

        $scope.item.desc = h.desc || '';
      }

      function showRemoveHis(h) {
        var title = T('auth.removeAK.title'); //??????AK
        var message = T('auth.removeAK.message', {id: h.id}); //'ID???'+h.id+', ?????????????'
        Dialog.confirm(title, message, function (b) {
          if (b) {
            AuthInfo.removeFromHistories(h.id);
            listHistories();
          }
        }, 1);
      }

      function listHistories() {
        $scope.his = AuthInfo.listHistories();
      }

      function showCleanHistories() {
        var title = T('auth.clearAKHistories.title'); //??????AK??????
        var message = T('auth.clearAKHistories.message'); //???????
        var successMessage = T('auth.clearAKHistories.successMessage'); //?????????AK??????
        Dialog.confirm(title, message, function (b) {
          if (b) {
            AuthInfo.cleanHistories();
            listHistories();
            Toast.success(successMessage);
          }
        }, 1);
      }


      function onSubmit(form1) {
        if (!form1.$valid) return;
        localStorage.setItem(KEY_REMEMBER, $scope.flags.remember);
        var data = angular.copy($scope.item);

        delete data.requestpaystatus;

        if (!data.requestpaystatus) {
          data.requestpaystatus = localStorage.getItem(SHOW_REQUEST_PAY) || 'NO';
        }
        //trim password
        if (data.secret) data.secret = data.secret.trim();

        delete data.authToken;
        delete data.securityToken;

        if (data.id.indexOf('STS.') != 0) {
          delete data.stoken;
        }

        if ($scope.flags.remember == 'YES') {
          AuthInfo.remember(data);
        }

        Toast.info(T('logining'), 1000);

        Auth.login(data).then(function () {
          if (!data.region && data.eptpl.indexOf('{region}') === -1) {
            var regExp = /https?:\/\/(\S*)\.aliyuncs\.com/;
            var res = data.eptpl.match(regExp);

            if (res) {
              data.region = res[1].replace('-internal', '');
              AuthInfo.save(data);
            }
          }
          if ($scope.flags.remember == 'YES') AuthInfo.addToHistories(data);
          Toast.success(T('login.successfully'), 1000);
          $location.url('/');
        }, function (err) {
          Toast.error(err.code + ':' + err.message);
        });

        return false;
      }

      //token login
      function onSubmit2(form2) {

        if (!form2.$valid) return;


        if (!$scope.authTokenInfo) {
          return;
        }

        var data = angular.copy($scope.authTokenInfo);

        Toast.info(T('logining'), 1000);//'????????????...'

        Auth.login(data).then(function () {
          Toast.success(T('login.successfully'), 1000);//'???????????????????????????...'
          $location.url('/');
        }, function (err) {
          Toast.error(err.code + ':' + err.message);
        });

        return false;
      }

    }])
;
