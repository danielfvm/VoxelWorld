const DB_NAME = "VoxelWorld1";

export namespace SaveSystem {

  export function save(name: string, data: any) {
    const request = indexedDB.open(DB_NAME, 4);

    // Set up the IndexedDB schema
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;

      db.createObjectStore('worldSaves', {
        autoIncrement: false
      });
    });

    request.onsuccess = () => {
      console.log('Database opened successfully');

      // Handle success opening the database
      const db = request.result;

      // Create a transaction and get the object store
      const objectStore = db.transaction('worldSaves', 'readwrite').objectStore('worldSaves');

      // Add the Uint32Array to the object store
      const addRequest = objectStore.put(data, name);

      // Handle the success or error of the add operation
      addRequest.onsuccess = () => console.log('Data saved successfully');
      addRequest.onerror = () => console.error('Error saving data');
    }

    request.onerror = () => console.error('Error opening database:', request.error);
    request.onupgradeneeded = () => console.error('Upgrade needed error:', request.error);
  }

  export function list(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 4);
      request.onsuccess = () => {
        const db = request.result;
        const objectStore = db.transaction(['worldSaves'], 'readonly').objectStore('worldSaves');
        const getRequest = objectStore.getAllKeys();

        getRequest.onsuccess = () => resolve(getRequest.result.map((key) => key.toString()));
        getRequest.onerror = () => reject(new Error('Error loading data'));
      };
      request.onerror = () => reject(new Error('Error opening database: ' + request.error));
    });
  }

  export function load(name: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 4);
      request.onsuccess = () => {
        const db = request.result;
        const objectStore = db.transaction(['worldSaves'], 'readonly').objectStore('worldSaves');
        const getRequest = objectStore.get(name);

        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(new Error('Error loading data'));
      };
      request.onerror = () => reject(new Error('Error opening database: ' + request.error));
    });
  }

  export function clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 4);
      request.onsuccess = () => {
        const db = request.result;
        const objectStore = db.transaction(['worldSaves'], 'readwrite').objectStore('worldSaves');
        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(new Error('Error clearing data'));
      }
    });
  }
}

