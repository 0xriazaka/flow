// Node imports
import fs from 'fs';

// Packages imports
import { Transaction } from '@mysten/sui/transactions';

import { getPacakgeId } from './waterCooler';
import config from "../../config.json";
import { getClient } from "./suiUtils";

export const getMoveObjectArray = (type: string, jsonContent: any) => {
  return new Promise(async (resolve, reject) => {
    const packageId = getPacakgeId();
    const client = getClient();

    // find the object that has the type
    function objectType(object: any) {
      return object.objectType == `${packageId}${type}`;
    };

    try {
        const objects = jsonContent?.objectChanges?.filter(objectType);
        const objectIds = objects.map((object: any) => object.objectId);

        // const moveObjects = [];

        const moveObjects = await client.multiGetObjects({
          ids: objectIds,
          options: {
            showContent: true
          },
        });

        // for (let i = 0; i < objectIds.length; i++) {
        //   const element = objectIds[i];
          
        //   console.log("element", element);

        //   // const tx = new Transaction();

        //   // tx.setGasBudget(config.gasBudgetAmount);

        //   const moveObject = await client.getObject({
        //     id: element,
        //     options: {
        //       showContent: true
        //     },
        //   });

        //   console.log("moveObject", moveObject);
          

        //   moveObjects.push(moveObject);
        // }

        console.log("moveObjects", moveObjects);

        resolve(moveObjects);
    } catch (error) {
      reject("The Water Cooler has not been initialized");
    }
  });
};
