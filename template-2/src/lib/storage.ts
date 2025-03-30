/**
 * Utility for storing and retrieving image data from IndexedDB
 */

// Define image data structure
export interface ImageData {
  timestamp: number;
  imageBase64: string;
}

/**
 * Stores image data in IndexedDB
 * @param imageData Array of image data with timestamp and base64 content
 * @param isProd Boolean flag to indicate production mode (affects storage details)
 * @returns Promise that resolves when data is stored
 */
export const storeImageData = async (imageData: ImageData[], isProd: boolean = false): Promise<void> => {
  if (!indexedDB) {
    console.error("Your browser doesn't support IndexedDB");
    return;
  }

  return new Promise((resolve, reject) => {
    const dbName = isProd ? "ai_video_creator_prod" : "ai_video_creator_dev";
    const request = indexedDB.open(dbName, 1);

    request.onerror = (event) => {
      console.error("Database error:", event);
      reject("Error opening database");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains("images")) {
        const store = db.createObjectStore("images", { keyPath: "timestamp" });
        store.createIndex("timestamp", "timestamp", { unique: true });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction("images", "readwrite");
      const store = transaction.objectStore("images");

      // Clear existing data first
      store.clear();

      // Store each image
      imageData.forEach((data) => {
        store.add(data);
      });

      transaction.oncomplete = () => {
        console.log(`Stored ${imageData.length} images in IndexedDB`);
        resolve();
      };

      transaction.onerror = (event) => {
        console.error("Transaction error:", event);
        reject("Error storing images");
      };
    };
  });
};

/**
 * Retrieves image data from IndexedDB
 * @param isProd Boolean flag to indicate production mode
 * @returns Promise that resolves with array of image data
 */
export const retrieveImageData = async (isProd: boolean = false): Promise<ImageData[]> => {
  if (!indexedDB) {
    console.error("Your browser doesn't support IndexedDB");
    return [];
  }

  return new Promise((resolve, reject) => {
    const dbName = isProd ? "ai_video_creator_prod" : "ai_video_creator_dev";
    const request = indexedDB.open(dbName, 1);

    request.onerror = (event) => {
      console.error("Database error:", event);
      reject("Error opening database");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "timestamp" });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction("images", "readonly");
      const store = transaction.objectStore("images");
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result);
      };

      getAllRequest.onerror = (event) => {
        console.error("GetAll error:", event);
        reject("Error retrieving images");
      };
    };
  });
}; 