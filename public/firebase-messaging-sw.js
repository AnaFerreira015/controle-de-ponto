/* global firebase */
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

function readFirebaseConfig() {
  var params = new URL(self.location.href).searchParams;
  return {
    apiKey: params.get("apiKey") || "",
    authDomain: params.get("authDomain") || "",
    projectId: params.get("projectId") || "",
    storageBucket: params.get("storageBucket") || "",
    messagingSenderId: params.get("messagingSenderId") || "",
    appId: params.get("appId") || ""
  };
}

var firebaseConfig = readFirebaseConfig();
var hasConfig = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId;

if (hasConfig && typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
  var messaging = firebase.messaging();

  messaging.onBackgroundMessage(function(payload) {
    var notification = payload.notification || {};
    var data = payload.data || {};
    var title = notification.title || data.title || "Controle de Ponto";
    var body = notification.body || data.body || "Você tem um lembrete de ponto.";

    self.registration.showNotification(title, {
      body: body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: {
        url: data.url || "/app"
      }
    });
  });
}

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/app";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
