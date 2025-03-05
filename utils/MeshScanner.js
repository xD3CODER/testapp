import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { MeshScanner } = NativeModules;
const meshScannerEvents = new NativeEventEmitter(MeshScanner);

class MeshScannerAPI {
  constructor() {
    this.listeners = [];
  }

  // Vérifier si l'appareil prend en charge le scan de mesh
  async checkSupport() {
    if (Platform.OS !== 'ios') {
      return { supported: false, reason: 'Platform not supported' };
    }
    return await MeshScanner.checkSupport();
  }

  // Démarrer un scan
  async startScan(options = {}) {
    if (Platform.OS !== 'ios') {
      throw new Error('Mesh scanning is only supported on iOS');
    }
    return await MeshScanner.startScan(options);
  }

  // Arrêter un scan et récupérer les données
  async stopScan() {
    if (Platform.OS !== 'ios') {
      throw new Error('Mesh scanning is only supported on iOS');
    }
    return await MeshScanner.stopScan();
  }

  // S'abonner aux mises à jour du mesh
  onMeshUpdate(callback) {
    if (Platform.OS !== 'ios') return { remove: () => {} };

    const listener = meshScannerEvents.addListener('onMeshUpdated', callback);
    this.listeners.push(listener);
    return listener;
  }

  // S'abonner à la fin du scan
  onScanComplete(callback) {
    if (Platform.OS !== 'ios') return { remove: () => {} };

    const listener = meshScannerEvents.addListener('onScanComplete', callback);
    this.listeners.push(listener);
    return listener;
  }

  // S'abonner aux erreurs
  onScanError(callback) {
    if (Platform.OS !== 'ios') return { remove: () => {} };

    const listener = meshScannerEvents.addListener('onScanError', callback);
    this.listeners.push(listener);
    return listener;
  }

  // Supprimer tous les listeners
  removeAllListeners() {
    this.listeners.forEach(listener => listener.remove());
    this.listeners = [];
  }
}

export default new MeshScannerAPI();