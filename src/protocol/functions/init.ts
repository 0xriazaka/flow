// Dependence
import 'dotenv/config';

// Packages imports
import { Transaction } from '@mysten/sui/transactions';
import _ from 'lodash';

// Local imports
import config from "../../../config.json";
import data from "../../../assets/metadata.json";
import { getClient, getKeypair } from "../../utils/suiUtils";
import { getPacakgeId } from "../../utils/waterCooler";
import { writeFile, readFile } from "../../utils/fileUtils";
import { getObjectIdArrayFromObject } from "../../utils/getObjectIdArray";
import { getMetadata } from "../../utils/getMetadata";
import { 
  WATER_COOLER_ADMIN_ID,
  WATER_COOLER_ID,
  COLLECTION_ID,
  REGISTRY_ID,
  CAPSULE_IDS,
  CAPSULE,
  REVEAL,
  BUY,
  INIT,
 } from "../../constants";
import { buyObjectInterface } from '../../interface/buyObjectInterface';

function findNFT(objectsResponse: any[], number: number) {
  for (const nftObject of objectsResponse) {
    if ('data' in nftObject && nftObject.data && 'content' in nftObject.data && nftObject.data.content && 'fields' in nftObject.data.content) {
      const objectNumber = parseInt(nftObject.data.content.fields.number);
      if (objectNumber === number) {
        return nftObject;
      }
    }
  }
  return null;
}

export default async () => {
  console.log("Revealing NFTs (Batched)");

  const buyObject = await readFile(`${config.network}_${BUY}`) as buyObjectInterface;
  const keypair = getKeypair();
  const client = getClient();
  const packageId = getPacakgeId();

  let initObjects: any = {
    CapsuleIDs: [],
    digest: [],
  };

  // We use this object to insure that the transaction has been comeplete
  // and the sequncer versioning is up to date before running the next transaction
  let txResponse = {
    digest: ''
  };

  console.log("Objects retrieved");


  console.log("Sorting Objects");
  

  const metaDataChuncks = _.chunk(data.metadata, 250);


  // Here we loop over the array of subarrays of metadata that has been arranged
  for (let i = 0; i < metaDataChuncks.length; i++) {

    // This is to make sure that we wait until the previous transaction is complete
    // before starting the next one
    if(txResponse?.digest as string != '') {
      await client.waitForTransaction({
        digest: txResponse.digest,
        options: { showObjectChanges: true }
      });
    }

    console.log(`Initiating NFTs batch #${i + 1}`);

    const tx = new Transaction();

    let numberArray: any = [];
    let keyArray: any = [];
    let valuesArray: any = [];
    let imageArray: any = [];



    // Here we loop over an individual subarray in order to create a transaction
    for (let j = 0; j < metaDataChuncks[i].length; j++) {
      const nftData = metaDataChuncks[i][j];


      const dataKeys: any[] = Object.keys(nftData.attributes);
      const dataValues: any[] = Object.values(nftData.attributes);

      let pureKeys = dataKeys.map(key => tx.pure.string(key));
      let pureValues = dataValues.map(value => tx.pure.string(value));

      const keys = tx.makeMoveVec({
        type: `0x1::string::String`,
        elements: pureKeys
      });

      const values = tx.makeMoveVec({
        type: `0x1::string::String`,
        elements: pureValues
      });

      imageArray.push(tx.pure.string(nftData.image_url));
      numberArray.push(tx.pure.u64(nftData.number));
      keyArray.push(keys);
      valuesArray.push(values);

    }

    const vetorKeys = tx.makeMoveVec({
      type: `vector<0x1::string::String>`,
      elements: keyArray
    });

    const vetorValues = tx.makeMoveVec({
      type: `vector<0x1::string::String>`,
      elements: valuesArray
    });

    const vectorNumbers = tx.makeMoveVec({
      type: `u64`,
      elements: numberArray
    });
    
    const vectorImages = tx.makeMoveVec({
      type: `0x1::string::String`,
      elements: imageArray
    });
    
    tx.setGasBudget(config.revealGasBudget);

    tx.moveCall({
      target: `${packageId}::water_cooler::initialize_with_data`,
      arguments: [
        tx.object(buyObject[WATER_COOLER_ADMIN_ID]),
        tx.object(buyObject[WATER_COOLER_ID]),
        tx.object(buyObject[REGISTRY_ID]),
        tx.object(buyObject[COLLECTION_ID]),
        vectorNumbers,
        vectorImages,
        vetorKeys,
        vetorValues,
      ]
    });

    let dataObject: {number: number | null, digest: string | null} = {number:null, digest: null};

    const objectChange = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showObjectChanges: true },
    });

    dataObject.number = i + 1;
    dataObject.digest = objectChange?.digest;

    txResponse = objectChange;

    const mizuNFTIdArray = await getObjectIdArrayFromObject(CAPSULE, objectChange);
    initObjects[CAPSULE_IDS] = initObjects[CAPSULE_IDS].concat(mizuNFTIdArray);

    initObjects.digest.push(dataObject);

    console.log(`NFT batch #${i + 1} has been initiated`);
  }

  await writeFile(`${config.network}_${INIT}`, initObjects);

  console.log("NFT reveal complete.");
}
