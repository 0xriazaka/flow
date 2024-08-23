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
import { 
  WATER_COOLER_ADMIN_ID,
  WATER_COOLER_ID,
  COLLECTION_ID,
  REGISTRY_ID,
  CAPSULE_IDS,
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
  console.log("Revealing NFTs");

  const buyObject = await readFile(`${config.network}_${BUY}`) as buyObjectInterface;
  // const initObject = await readFile(`${config.network}_${INIT_OBJECTS}`) as InitObjectInterface;
  const initObject = await readFile(`${config.network}_${INIT}`) as any;
  const keypair = getKeypair();
  const client = getClient();
  const packageId = getPacakgeId();

  // Convert the capsule ID array into chucks to retrive the objects
  // as the multiGetObjects function is limited to 50 objects
  const chunckedCapsuleIDArray = _.chunk(initObject[CAPSULE_IDS], 50);


  let CapsuleObjects: any = [];

  // Retrieve the Capsule objects and store them in an array
  for (let i = 0; i < chunckedCapsuleIDArray.length; i++) {
    const chuckCapsuleObjects = await client.multiGetObjects({
      ids: chunckedCapsuleIDArray[i] as any[],
      options: {
        showContent: true
      },
    });

    CapsuleObjects = CapsuleObjects.concat(chuckCapsuleObjects);
  }

  let revealObject = [];

  // We use this object to insure that the transaction has been comeplete
  // and the sequncer versioning is up to date before running the next transaction
  let txResponse = {
    digest: ''
  };

  for (let i = 0; i < data.metadata.length; i++) {

// This is to make sure that we wait until the previous transaction is complete
// before starting the next one
    if(txResponse?.digest as string != '') {
      await client.waitForTransaction({
        digest: txResponse.digest,
        options: { showObjectChanges: true }
      });
    }

    console.log(`Revealing NFT #${i + 1}`);
    const nftData = data.metadata[i];    

    let nftMoveObject = findNFT(CapsuleObjects, nftData.number);

    const tx = new Transaction();

    const dataKeys = Object.keys(nftData.attributes);
    const dataValues: any[] = Object.values(nftData.attributes);

    let pureKeys = dataKeys.map(key => tx.pure.string(key));
    let pureValues = dataValues.map(value => tx.pure.string(value));

    let dataObject: {number: number | null, digest: string | null} = {number:null, digest: null};

    tx.setGasBudget(config.gasBudgetAmount);

    const keys = tx.makeMoveVec({
      type: `0x1::string::String`,
      elements: pureKeys
    });

    const values = tx.makeMoveVec({
      type: `0x1::string::String`,
      elements: pureValues
    });
    
    tx.moveCall({
      target: `${packageId}::water_cooler::reveal_nft`,
      arguments: [
        tx.object(buyObject[WATER_COOLER_ADMIN_ID]),
        tx.object(buyObject[WATER_COOLER_ID]),
        tx.object(buyObject[REGISTRY_ID]),
        tx.object(buyObject[COLLECTION_ID]),
        tx.object(nftMoveObject?.data?.objectId),
        keys,
        values,
        tx.pure.string(nftData.image_url),
      ]
    });

    const objectChange = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showObjectChanges: true },
    });

    dataObject.number = i + 1;
    dataObject.digest = objectChange?.digest;

    txResponse = objectChange;

    revealObject.push(dataObject);

    console.log(`NFT #${i + 1} has been revealed`);
  }

  await writeFile(`${config.network}_${REVEAL}`, revealObject);

  console.log("NFT reveal complete.");
}
