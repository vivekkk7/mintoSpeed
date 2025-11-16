const session = require('express-session');
const admin = require('firebase-admin');

class FirebaseStore extends session.Store {
  constructor() {
    super();
    this.sessionsRef = admin.database().ref('sessions');
  }

  async get(sid, callback) {
    try {
      const snapshot = await this.sessionsRef.child(sid).once('value');
      const session = snapshot.val();
      callback(null, session ? JSON.parse(session) : null);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, session, callback) {
    try {
      await this.sessionsRef.child(sid).set(JSON.stringify(session));
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback) {
    try {
      await this.sessionsRef.child(sid).remove();
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
  
}

module.exports = FirebaseStore;
