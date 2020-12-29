const { validatePlayBookSave, validateJobInput,
    validateJobInputFile, validateJobInputForm, validateJobResult, validateSalesSearch,
    validateSalesSearch1,
    validatePullPubSub,
    validateEnrichment,
    validateGetContact,
    validateEnrichPullPubSub } = require('../models/jobs');
const router = require("express").Router()
const { successOutput, errorOuput, getPlaybookSuccess,
    getJobsListSuccess } = require('../models/ouput');
const config = require('../appConfig');
const fs = require('fs');
const { Storage } = require("@google-cloud/storage");
const verifyIdToken = require("../middleware/auth");
const { checkCreditsAvailable } = require("../middleware/jobs");
const { itemsPerPage, getContactNumberURL, listManagerAPI, creditsUsedCount, getCompanyId,
    writeDataInListCollectionFile, salesSerpURL, enrich1BusinessContact,
    enrich1PersonalContact } = require("../util");
const admin = require("firebase-admin");
const moment = require("moment");
const winston = require('winston');
const uuid = require("uuid")
const pubsub = require("../pubsub/pullJobs_del");
const axios = require('axios');




/**
 * 
 * get playbook json file to give job input form to the web user
 * 
 */
router.get("/getPlayBook/:pid", verifyIdToken, async (req, res) => {

    if (req.params == undefined || req.params.pid == undefined || req.params.pid < 1)
        return res.status(400).json(errorOuput(req.t(`error.pid`)));

    let { pid } = req.params;
    try {
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        var isExists = await storage.bucket(config.get("gcloud_pbook_storage")).file(`playbook${pid}.json`).exists() || [];
        if (isExists.length > 0 && isExists[0]) {
            var readF = storage.bucket(config.get("gcloud_pbook_storage")).file(`playbook${pid}.json`).createReadStream();
            var buf = '';
            readF.on('data', function (d) {
                buf += d;
            }).on('end', function () {
                return res.json(getPlaybookSuccess(JSON.parse(buf), pid));
            });
        } else
            return res.status(400).json(errorOuput(req.t(`error.file_not_found`)));
    } catch (error) {
        return res.status(400).json(errorOuput(error.message));
    }


});



/**
 */
router.post("/submitJobInput", [verifyIdToken, validateJobInput], async (req, res) => {

    const { user_id } = req.user;
    let iFile;

    try {
        if (!req.files)
            return res.status(400).json(errorOuput(req.t(`validation.noFilesUploaded`)));
        else
            iFile = req.files.file;


        /**Job master save data */
        /*create input file name <userid>_<unique_job_id>_i.json */

        /* Write File */
        let uuidv1 = uuid.v1();
        var fileName = `${user_id}_${uuidv1}_i.json`;

        /**Upload file */
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        const file = storage.bucket(config.get("gcloud_jobs_storage")).file(fileName);

        const stream = file.createWriteStream({
            metadata: {
                contentType: "application/json"
            },
            resumable: false
        });

        stream.on('error', (err) => {
            return res.status(400).json(errorOuput(err));
        });

        stream.on('finish', () => {
            saveJobInputSumbitOnStore(fileName, req, res);
        });

        stream.end(iFile.data);


    } catch (error) {
        // return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }



});

/**Submit multiple job input
 * Not using
 */
router.post("/submitMultipleJobInput", [verifyIdToken, validateJobInput], async (req, res) => {

    const { user_id } = req.user;
    let iFile;

    try {
        if (!req.files)
            return res.status(400).json(errorOuput(req.t(`validation.noFilesUploaded`)));
        else
            iFile = req.files.file;


        /**Job master save data */
        /*create input file name <userid>_<unique_job_id>_i.json */

        /* Write File */
        let uuidv1 = uuid.v1();
        var fileName_1 = `${user_id}_${uuidv1}_1_i.json`;
        var fileName_2 = `${user_id}_${uuidv1}_2_i.json`;

        /**Upload file */
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        const file1 = storage.bucket(config.get("gcloud_jobs_storage")).file(fileName_1);
        const file2 = storage.bucket(config.get("gcloud_jobs_storage")).file(fileName_2);

        let jobId = uuid.v1();
        let jobId_1 = jobId + '_1';
        let jobId_2 = jobId + '_2';


        await new Promise((res, rej) => {

            const stream = file1.createWriteStream({
                metadata: {
                    contentType: "application/json"
                },
                resumable: false
            });

            stream.on('error', (err) => {
                rej(error);
            });

            stream.on('finish', () => {
                let jobMasterSaveResult = saveMultipleJobInputSumbitOnStore(fileName_1, jobId_1, req, res);
                res(jobMasterSaveResult);
            });

            stream.end(iFile.data);
        });

        await new Promise((res, rej) => {

            const stream = file2.createWriteStream({
                metadata: {
                    contentType: "application/json"
                },
                resumable: false
            });

            stream.on('error', (err) => {
                rej(error);
            });

            stream.on('finish', () => {
                let jobMasterSaveResult = saveMultipleJobInputSumbitOnStore(fileName_2, jobId_2, req, res);
                res(jobMasterSaveResult);
            });

            stream.end(iFile.data);
        })

        res.json(successOutput(
            {
                "job_code": jobId,
                "message": req.t("response.data_saved")
            }
        ))


    } catch (error) {
        // return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }


});


/***
 * This functionality moved to linkedin scraper service
 */
router.post("/submitJobResult", [verifyIdToken, validateJobResult], async (req, res) => {

    const { user_id } = req.user;
    let iFile;

    try {
        if (!req.files)
            return res.status(400).json(errorOuput(req.t(`validation.noFilesUploaded`)));
        else
            iFile = req.files.file;


        /**Job master save data */
        /*create output file name <userid>_<unique_job_id>_o.json */

        /* Write File */
        let uuidv1 = uuid.v1();
        var fileName = `${user_id}_${uuidv1}_o.json`;

        /**Upload file */
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        const file = storage.bucket(config.get("gcloud_jobs_storage")).file(fileName);

        const stream = file.createWriteStream({
            metadata: {
                contentType: "application/json"
            },
            resumable: false
        });

        stream.on('error', (err) => {
            return res.status(400).json(errorOuput(err));
        });

        stream.on('finish', () => {
            updateJobSumbitOnStore(fileName, req, res);
        });

        stream.end(iFile.data);
    } catch (error) {
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }

});



router.get("/getJobs", verifyIdToken, async (req, res) => {

    let { status, sort, page, totalPages } = req.query;


    try {
        let db = admin.firestore();
        let jobMasterRef = db.collection("jobMaster");
        let docCollection = [];
        let queryRef;
        let perPage = itemsPerPage; //10 
        //get total number of pages for the first call when page = 1
        if (page == 1) {
            try {
                let listQuery = (status && status != "All") ? jobMasterRef.where('status', '==', status) : jobMasterRef;
                let listData = await listQuery.get();
                totalPages = Math.ceil(listData.size / perPage);

            } catch (error) {
                res.status(400).send(errorOuput(error));
            }
        }

        queryRef = (status && status != "All") ?
            jobMasterRef.where('status', '==', status).orderBy('stm', sort || 'asc').limit(perPage).offset(perPage * (parseInt(page) - 1)).get()
            :
            jobMasterRef.orderBy('stm', sort || 'asc').limit(perPage).offset(perPage * (parseInt(page) - 1)).get();


        queryRef.then(snapshot => {
            snapshot.forEach(doc => {
                docCollection.push(doc.data());
            });
            res.json(getJobsListSuccess(docCollection, page, totalPages));
        })
            .catch(err => {
                console.log('Something went wrong', err);
                res.status(400).send(errorOuput(err));
            });
    } catch (error) {
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }



});


router.get("/getJobInputDetails/:jid", verifyIdToken, async (req, res) => {

    try {
        if (req.params == undefined || req.params.jid == undefined)
            return res.status(400).json(errorOuput(req.t(`validation.jid`)));

        let { jid } = req.params;
        let db = admin.firestore();
        let jobMasterRef = db.collection("jobMaster");
        jobMasterRef.where('jid', "==", jid).get()
            .then(snapshot => {
                if (snapshot.empty) {
                    res.status(400).send(errorOuput(req.t("error.job_id_not_valid")));
                }
                let data;
                snapshot.forEach(doc => {
                    data = doc.data();
                });
                /*  if (data.o_j == undefined)
                     res.status(400).send(errorOuput(req.t("error.job_not_submitted"))); */

                const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
                var readF = storage.bucket(config.get("gcloud_jobs_storage")).file(data.i_j).createReadStream();
                var buf = '';
                readF.on('data', function (d) {
                    buf += d;
                }).on('end', function () {
                    return res.json(successOutput(JSON.parse(buf)));
                });

            })
            .catch(err => {
                console.log('Error getting documents', err);
                res.status(400).send(errorOuput(req.t("error.job_id_not_valid")));
            });
    } catch (error) {
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));

    }

});

router.get("/getJobResultDetails/:jid", verifyIdToken, async (req, res) => {

    try {
        if (req.params == undefined || req.params.jid == undefined)
            return res.status(400).json(errorOuput(req.t(`error.jid`)));

        let { jid } = req.params;
        let db = admin.firestore();
        let jobMasterRef = db.collection("jobMaster");
        jobMasterRef.where('jid', "==", jid).get()
            .then(snapshot => {
                if (snapshot.empty) {
                    res.status(400).send(errorOuput(req.t("error.something_failed")));
                }
                let data;
                snapshot.forEach(doc => {
                    data = doc.data();
                });
                if (data.o_j == undefined)
                    res.status(400).send(errorOuput(req.t("error.job_not_submitted")));

                const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
                var readF = storage.bucket(config.get("gcloud_jobs_storage")).file(data.o_j).createReadStream();
                var buf = '';
                readF.on('data', function (d) {
                    buf += d;
                }).on('end', function () {
                    return res.json(successOutput(JSON.parse(buf)));
                });

            })
            .catch(err => {
                console.log('Error getting documents', err);
                res.status(400).send(errorOuput(req.t("error.something_failed")));
            });
    } catch (error) {
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));

    }



});



/**
 * Will not use at client level add play book API
 */
router.post("/addPlayBook", validatePlayBookSave, async (req, res) => {

    try {
        const { pid } = req.body;
        let iFile;

        if (!req.files)
            return res.status(400).json(errorOuput(req.t(`validation.noFilesUploaded`)));
        else
            iFile = req.files.file;

        var fileName = `playbook${pid}.json`;

        /**Upload file */
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        const file = storage.bucket(config.get("gcloud_pbook_storage")).file(fileName);

        const stream = file.createWriteStream({
            metadata: {
                contentType: "application/json"
            },
            resumable: false
        });

        stream.on('error', (err) => {
            return res.status(400).json(errorOuput(err));
        });

        stream.on('finish', () => {
            return res.json(successOutput({ "message": req.t("response.file_created") }));
        });

        stream.end(iFile.data);
    } catch (error) {
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));

    }


});


router.get("/getUserCredits", [verifyIdToken], async (req, res) => {

    try {

        const { user_id } = req.user;
        var db = admin.firestore();

        //get cid from company master table using user_id
        const getCompanyDetails = await getCompanyId(user_id);
        if (getCompanyDetails.status == "error")
            return res.status(400).json(errorOuput(req.t(getCompanyDetails.message)));

        let { cid } = getCompanyDetails.data;

        var usageMasterRef = db.collection("usageMaster");

        //check if credits available
        let creditsResult = await creditsUsedCount(usageMasterRef, cid);
        if (creditsResult.status == "error")
            return res.status(400).json(errorOuput(req.t(creditsResult.message)));

        let { crdMax, crdUsed } = creditsResult.data;
        res.status(200).send(successOutput({ crdMax, crdUsed }));


    } catch (error) {
        winston.info("get credits error" + error);
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }

});



/**
 * NOT USING
 * submit job input form to the job master collection
 * 
 */
router.post("/submitJobInputFile", [verifyIdToken, validateJobInputFile], async (req, res) => {

    try {

        const { user_id } = req.user;
        const { fields } = req.body;

        /**Job master save data */
        /*create input file name <userid>_<unique_job_id>.json */

        /* Write File */
        let uuidv1 = uuid.v1();;
        var fileName = `${user_id}_${uuidv1}_i.json`;
        var filePath = `${process.cwd()}/tmp/${fileName}`;
        fs.writeFileSync(filePath, fields);


        /* return listFiles().then((result)=>{
            return res.send(result);
        }).catch(console.error); */


        /**Upload file */
        uploadFileToStorage(filePath, uuidv1).catch(e => { throw (e) });


        res.json(successOutput({ "fileId": fileName.split('.')[0] }));
    } catch (error) {
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }

});

/**
 * NOT USING
 */
router.post("/submitJobInputForm", [verifyIdToken, validateJobInputForm], async (req, res) => {

    try {

        const { user_id } = req.user;

        const { pid, fileId } = req.body;
        let jobId = uuid.v1();;

        let db = admin.firestore();
        let jobMasterRef = db.collection("jobMaster");
        let jobMasterBody = {
            jid: jobId,
            uid: user_id,
            pid: pid,
            i_j: fileId + ".json",
            status: "In progress",
            stm: moment().format('LLL')
        }

        //Delete locally created file
        try {
            fs.unlinkSync(`${process.cwd()}/tmp/${fileId}.json`);
        } catch (error) {
            res.status(400).json(errorOuput(error));
        }

        jobMasterRef.doc(jobId).set(jobMasterBody).then((result) => res.json(successOutput(
            {
                "job_code": jobId,
                "message": req.t("response.data_saved")
            }
        ))).catch((e) => res.status(400).json(errorOuput(e)));
    } catch (error) {
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));

    }

});

/**
 * It will be called from chrome extension app
 * It get contact number from external contact api
 */
router.post("/getContactInfo", [validateGetContact, verifyIdToken, checkCreditsAvailable], async (req, res) => {

    try {
        const { user_id, cid } = req.user; //middleware
        const { lid } = req.body;
        const { crdUsed, crdMax } = req.credits; //middleware
        const nameOfList = "Default lead list";


        ///See if we have search result for this profile already or searched for the lid by another user
        let masterContactResult = await checkMasterDBHasContactResult(req, nameOfList);
        if (masterContactResult.status == "success")
            return res.status(200).send(successOutput(masterContactResult.data));

        //Get contacts info

        //delete later
        req.body.userEmail = req.user.email; //TO-DO Remove when hardcoded result removed from contact api

        let contactResult = await contactFromFunctionAPI(req.body);
        if (contactResult.status == "error")
            return res.status(400).json(errorOuput(req.t(contactResult.message)));

        delete req.body["userEmail"];

        //update contacts result list collection json file with this contact list data
        let contactResultData = JSON.parse(contactResult.data);
        let contactAPIOutput = JSON.parse(contactResult.output); //raw output from API

        let body = Object.assign(req.body);

        //Save result in master details database
        let saveMasterContactData = await saveMasterContactResult(cid, body, contactResultData, contactAPIOutput).catch(e => { throw e });
        if (saveMasterContactData.status == "error")
            return res.status(400).json(errorOuput(saveMasterContactData.message));

        if (contactResultData.hasOwnProperty("phones"))
            req.body.contactNumber = contactResultData.phones.join(', ');
        if (contactResultData.hasOwnProperty("emails"))
            req.body.emails = contactResultData.emails.join(', ');

        let updatelistResult = await readUpdateContactsListItem(user_id, nameOfList, req.body).catch(e => { throw e });
        if (updatelistResult.status == "error")
            return res.status(400).json(errorOuput(updatelistResult.message));


        //user_id is the company id collection id
        let creditsUpdateResult = await updateCreditsUsedByOne(cid, (crdUsed + 1)).catch(e => { throw e });
        if (creditsUpdateResult.status == "error")
            return res.status(400).json(errorOuput(req.t(creditsUpdateResult.message)));

        contactResultData.credits = { crdUsed: crdUsed + 1, crdMax };
        return res.status(200).send(successOutput(contactResultData));


    } catch (error) {
        console.log("get contact number error" + error);
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }

});


/**
 * Read default list contacts
 */
router.post("/getContactsList", verifyIdToken, async (req, res) => {

    try {

        const { type } = req.body;
        const { user_id } = req.user; //middleware
        const nameOfList = "Default lead list";


        let reqListCollection = await getUserContactsListItemFileName(user_id, nameOfList);
        if (reqListCollection.status == "error")
            return { status: "error", message: reqListCollection.message };

        let fileName = reqListCollection.fileName;
        // console.log("fileName", fileName);


        //Get file data
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        var file = await storage.bucket(config.get("gcloud_list_storage")).file(fileName);

        let oldFileDataListResult = await readUserContactListItem(file);
        if (oldFileDataListResult.status == "error")
            return { status: "error", message: oldFileDataListResult.message };


        res.send(successOutput(oldFileDataListResult));


    } catch (error) {
        console.log("updateContactsListCollection ", error);
        return res.status(400).json(errorOuput(error));
    }


});


/**
 * 
 * This will be called from web.
 * It does create,save,move,udpate operation on the list
 * 
 * 
 */
router.post("/listManager", verifyIdToken, async (req, res) => {

    try {

        const { user_id } = req.user;
        req.body.user_id = user_id;
        return await axios.post(listManagerAPI, req.body)
            .then(function (response) {
                return res.status(200).send(response.data);
            })
            .catch(function (error) {
                console.log(error);
                return res.status(400).send({ message: error });
            })

    } catch (error) {
        console.log("listManager ", error);
        return res.status(400).json(errorOuput(error));
    }

});


/**
 * 
 */
router.post("/salesNavSearch", [verifyIdToken, validateSalesSearch1], async (req, res) => {

    try {

        // winston.info("sales nav search body"+ JSON.stringify(req.body));
        await pubsub.publishSalesSearch(JSON.stringify(req.body)).catch(e => { throw (e) });
        res.send(successOutput(req.t("response.search_started")));

    } catch (error) {
        winston.info("sales nav search error" + error);
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }

});

router.post("/salesNavSearch_t1", [verifyIdToken, validateSalesSearch1], async (req, res) => {

    try {
        const { user_id } = req.user;

        let jobId = uuid.v1();
        req.body.jobInput = JSON.parse(req.body.jobInput);
        req.body.jobInput.jobId = jobId;
        req.body.jobInput.uid = user_id;

        //push to load balancer pubsub
        await pubsub.publishSalesSearch(JSON.stringify(req.body.jobInput)).catch(e => { throw (e) });
        res.send(successOutput({
            "jobId": jobId,
            "message": req.t("response.search_started")
        }));

    } catch (error) {
        winston.info("sales nav search error" + error);
        return res.status(400).json(errorOuput(req.t(`error.something_failed`)));
    }

});

/**
 * 
 */
router.post("/salesNavSearch_t2", [verifyIdToken, validateSalesSearch], async (req, res) => {

    try {

        const { user_id } = req.user;

        let jobId = uuid.v1();
        req.body.jobInput = JSON.parse(req.body.jobInput);
        req.body.jobInput.jobId = jobId;
        req.body.jobInput.uid = user_id;

        axios.post(salesSerpURL, req.body.jobInput)
            // .then(function (response) {
            //     // return res.status(200).send(response.data);
            //     console.log(response.data);
            // })
            .catch(function (error) {
                console.log(error);
                return res.status(400).send(errorOuput(error));
            })

        return res.send(successOutput({
            "jobId": jobId,
            "message": req.t("response.search_started")
        }));


    } catch (error) {
        winston.info("sales nav search error" + error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});


/**
 * Call Enrich1_BusinessContact 
 */

router.post("/jobManager_E1", [verifyIdToken, validateEnrichment], async (req, res) => {

    try {
        const { user_id } = req.user;

        req.body.jobInput = JSON.parse(req.body.jobInput); //Array of object

        req.body.jobInput.map(item => {
            let jobId = uuid.v4(); //random uuid
            item.jobId = jobId;
            item.uid = user_id;
        });

        axios.post(enrich1BusinessContact, req.body.jobInput)
            .then(function (response) {
                // console.log(response.data);
                let jobIdsList = req.body.jobInput.map(item => item.jobId);

                return res.send(successOutput({
                    "job_code_list": jobIdsList,
                    "message": req.t("response.data_saved"),
                    "data": response.data
                }));
            })
            .catch(function (error) {
                console.log("error", error.message);
                return res.status(400).send({ message: error });
            });

        /*  let jobIdsList = req.body.jobInput.map(item => item.jobId);
         return res.send(successOutput({
             "job_code_list": jobIdsList,
             "message": req.t("response.data_saved")
         })); */


    } catch (error) {
        winston.info("jobManager_E1 error" + error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});

/**
 * Call Enrich1_PersonalContact and Business contact
*/
router.post("/jobManager_E2", [verifyIdToken, validateEnrichment], async (req, res) => {

    try {

        const { user_id } = req.user;

        req.body.jobInput = JSON.parse(req.body.jobInput); //Array of object

        //Business contact job id
        let businessContactBody = [];
        req.body.jobInput.map(item => {
            let jobId = uuid.v4();
            let newItem = Object.assign({}, item);
            newItem.jobId = jobId + "_1";
            newItem.uid = user_id;
            newItem.pid = "I";
            newItem.task = 10;
            businessContactBody.push(newItem);
        });



        axios.post(enrich1BusinessContact, businessContactBody)
            // .then(function (response) {
            //     console.log(response.data);
            // })
            .catch(function (error) {
                console.log(error);
            })

        //Business contact job id
        let personalContactBody = [];
        businessContactBody.map(item => {
            let jobId = item.jobId.split('_')[0];
            let newItem = Object.assign({}, item);
            newItem.jobId = jobId + "_2";
            newItem.uid = user_id;
            newItem.pid = "J";
            newItem.task = 11;
            newItem.userEmail = req.user.email; //To-Do remove later
            personalContactBody.push(newItem);
        });

        console.log(businessContactBody);
        console.log(personalContactBody);

        axios.post(enrich1PersonalContact, personalContactBody)
            // .then(function (response) {
            //     console.log(response.data);
            // })
            .catch(function (error) {
                console.log(error);
            })


        let jobIdsList = personalContactBody.map(item => item.jobId.split("_")[0]);

        return res.send(successOutput({
            "job_code_list": jobIdsList,
            "message": req.t("response.data_saved")
        }));

    } catch (error) {
        winston.info("jobManager_E2 error" + error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});



/**
 * Call Enrich1_BusinessContact 
 * Direct Enrichment call without queue
 */

router.post("/jobManager_test_E1", [verifyIdToken, validateEnrichment], async (req, res) => {

    try {
        const { user_id } = req.user;

        req.body.jobInput = JSON.parse(req.body.jobInput); //Array of object

        req.body.jobInput.map(item => {
            let jobId = uuid.v4(); //random uuid
            item.jobId = jobId;
            item.uid = user_id;
        });

        axios.post(enrich1BusinessContact, req.body.jobInput)
            .then(function (response) {
                // console.log(response.data);
                let jobIdsList = req.body.jobInput.map(item => item.jobId);

                return res.send(successOutput({
                    "job_code_list": jobIdsList,
                    "message": req.t("response.data_saved"),
                    "data": response.data
                }));
            })
            .catch(function (error) {
                console.log("error", error.message);
                return res.status(400).send({ message: error });
            });

    } catch (error) {
        winston.info("jobManager_test_E1 error" + error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});

/**
 *direct Enrichment call without queue
 */
router.post("/jobManager_test_E2", [verifyIdToken, validateEnrichment], async (req, res) => {

    try {

        const { user_id } = req.user;

        req.body.jobInput = JSON.parse(req.body.jobInput); //Array of object

        const {isOnlyE2Required} = req.body.jobInput[0]; //only 1 object comes in this payload

        //Business contact job id
        let businessContactBody = [];
        req.body.jobInput.map(item => {
            let jobId = uuid.v4();
            let newItem = Object.assign({}, item);
            newItem.jobId = jobId + "_1";
            newItem.uid = user_id;
            newItem.pid = "I";
            newItem.task = 10;
            businessContactBody.push(newItem);
        });

        let personalContactBody = [];
        businessContactBody.map(item => {
            let jobId = item.jobId.split('_')[0];
            let newItem = Object.assign({}, item);
            newItem.jobId = jobId + "_2";
            newItem.uid = user_id;
            newItem.pid = "J";
            newItem.task = 11;
            newItem.userEmail = req.user.email; //To-Do remove later
            personalContactBody.push(newItem);
        });


        let enrichCalls = [
            new Promise((res, rej) => {
                axios.post(enrich1PersonalContact, personalContactBody)
                    .then(function (response) {
                        res(response.data);
                    })
                    .catch(function (error) {
                        console.log(error);
                    })
            })
           ];

           //only when personal information is rquired. do not allow business contact
            if(!isOnlyE2Required)
                enrichCalls.push(new Promise((res, rej) => {
                    axios.post(enrich1BusinessContact, businessContactBody)
                        .then(function (response) {
                                res(response.data);
                        })
                        .catch(function (error) {
                            console.log(error);
                        })
                }));


        let result = await Promise.all(enrichCalls);

        let jobIdsList = personalContactBody.map(item => item.jobId.split("_")[0]);

        console.log(result);

        return res.send(successOutput({
            "job_code_list": jobIdsList,
            "message": req.t("response.data_saved"),
            data : result
        }));

    } catch (error) {
        winston.info("jobManager_E2 error" + error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});



/**Type 1 search pull jobs */
router.post("/pullJobs_t1", [verifyIdToken, validatePullPubSub], async (req, res) => {

    try {
        const { jobId, pageNumber } = req.body;
        const result = await pubsub.listenMessagesSNSearch_type1(jobId, pageNumber).catch(e => e);
        if (result == "No messages found")
            res.status(400).json(errorOuput(result));
        else
            res.status(200).json(successOutput(result));

    } catch (error) {
        console.log(error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});



/**Type 1 search pull jobs */
router.post("/pullJobs_t2", [verifyIdToken, validatePullPubSub], async (req, res) => {

    try {
        const { jobId, pageNumber } = req.body;
        const result = await pubsub.listenMessagesSNSearch_type2(jobId, pageNumber).catch(e => e);
        if (result == "No messages found")
            res.status(400).json(errorOuput(result));
        else
            res.status(200).json(successOutput(result));

    } catch (error) {
        console.log(error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});



/**Enrich business contact pull jobs */
router.post("/pullJobs_BusinessEnrich_E1", [verifyIdToken, validateEnrichPullPubSub], async (req, res) => {

    try {
        const { jobIds } = req.body;
        console.log(jobIds);
        const result = await pubsub.listenMessagesBusinessEnrich_E1(jobIds).catch(e => { throw e });
        if (result == "No messages found")
            res.status(400).json(errorOuput(result));
        else
            res.status(200).json(successOutput(result));

    } catch (error) {
        console.log(error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});



/**Enrich business contact push jobs
 * 
 * Enrich E1
 * 
 * It stores enrich details in the cloud
 * 
 */
router.post("/postProcessE1", async (req, res) => {

    try {

        req.body.methodType = "SAVE";

        return await axios.post(listManagerAPI, req.body)
            .then(function (response) {
                return res.status(200).send(response.data);
            })
            .catch(function (error) {
                console.log(error);
                return res.status(400).send({ message: error });
            })

    } catch (error) {
        console.log("postProcessE1 ", error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});

/**Enrich business contact push jobs
 * 
 * Enrich E2 
 * 
 * It stores enrich details in the cloud
 * 
 */
router.post("/postProcessE2", async (req, res) => {

    try {

        req.body.methodType = "SAVE";

        return await axios.post(listManagerAPI, req.body)
            .then(function (response) {
                return res.status(200).send(response.data);
            })
            .catch(function (error) {
                console.log(error);
                return res.status(400).send({ message: error });
            })


    } catch (error) {
        console.log("postProcessE2 ", error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});



/**Enrich business contact pull jobs */
router.post("/pullJobs_PersonalEnrich_E2", [verifyIdToken, validateEnrichPullPubSub], async (req, res) => {

    try {
        const { jobIds } = req.body;
        console.log(jobIds);
        const result = await pubsub.listenMessagesPersonalEnrich_E2(jobIds).catch(e => { throw e });
        if (result == "No messages found")
            res.status(400).json(errorOuput(result));
        else
            res.status(200).json(successOutput(result));

    } catch (error) {
        console.log(error);
        return res.status(500).json(errorOuput(req.t(`error.something_failed`)));
    }

});









async function saveJobInputSumbitOnStore(fileName, req, res) {

    try {
        const { user_id } = req.user;

        const { pid } = req.body;
        let jobId = uuid.v1();
        let db = admin.firestore();
        let jobMasterRef = db.collection("jobMaster");
        let jobMasterBody = {
            jid: jobId,
            uid: user_id,
            pid: pid,
            i_j: fileName,
            status: "In progress",
            stm: moment().format('LLL')
        }

        return await jobMasterRef.doc(jobId).set(jobMasterBody).then((result) => {
            return {
                "job_code": jobId,
                "message": req.t("response.data_saved")
            }
        }
        ).catch((e) => res.status(400).json(errorOuput(e)));
    } catch (error) {
        return res.status(500).json(errorOuput(error));

    }

}


/**
 * Multiple job input store
 * Not using
 * @param {*} fileName 
 * @param {*} req 
 * @param {*} res 
 */
async function saveMultipleJobInputSumbitOnStore(fileName, jid, req, res) {

    try {
        const { user_id } = req.user;

        const { pid } = req.body;
        let db = admin.firestore();
        let jobMasterRef = db.collection("jobMaster");
        let jobMasterBody = {
            jid: jid,
            uid: user_id,
            pid: pid,
            i_j: fileName,
            status: "In progress",
            stm: moment().format('LLL')
        }

        return await jobMasterRef.doc(jid).set(jobMasterBody).then((result) => {
            return {
                "job_code": jid,
                "message": req.t("response.data_saved")
            }
        }
        ).catch((e) => res.status(400).json(errorOuput(e)));
    } catch (error) {
        return res.status(500).json(errorOuput(error));
    }

}


function updateJobSumbitOnStore(fileName, req, res) {
    const { jid } = req.body;
    let db = admin.firestore();
    let jobMasterRef = db.collection("jobMaster");
    // console.log(jid);
    jobMasterRef.doc(jid).update({ o_j: fileName, status: "Completed" }).then((result) => res.json(successOutput(
        {
            "message": req.t("response.data_saved")
        }
    ))).catch((e) => res.status(400).json(errorOuput(e)));
}


async function uploadFileToStorage(filePath, uuid) {

    const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });

    // Uploads a local file to the bucket
    await storage.bucket(config.get("gcloud_jobs_storage")).upload(filePath, {
        // Support for HTTP requests made with `Accept-Encoding: gzip`
        gzip: true,
        // By setting the option `destination`, you can change the name of the
        // object you are uploading to a bucket.
        metadata: {
            cacheControl: 'public, max-age=31536000',
            metadata: {
                firebaseStorageDownloadTokens: uuid
            }
        },
    });

    // return uploadedResult;
}

async function listFiles() {
    // Lists files in the bucket
    const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
    const [files] = await storage.bucket(config.get("gcloud_jobs_storage")).getFiles();
    files.forEach(file => {
        console.log(file.name);
    });

    return files;
}


async function contactFromFunctionAPI(body) {

    try {
        return await axios.post(getContactNumberURL, body)
            .then(function (response) {
                //success
                console.log(response.data.data);
                return { status: "success", data: response.data.data, output: response.data.output }
            })
            .catch(function (error) {
                console.log(error);
                return { status: "error", message: "No result found" }
            })
    } catch (error) {
        return { status: "error", message: error.message }
    }

}



async function updateCreditsUsedByOne(cid, creditUsedByNow) {

    var db = admin.firestore();
    var usageMasterRef = db.collection("usageMaster");

    //get cid from company master table using user_id
    const getUsageMasterDetails = await getUsageMasterDocId(usageMasterRef, cid);
    if (getUsageMasterDetails.status == "error")
        return { status: "error", message: getUsageMasterDetails.message }

    let { id } = getUsageMasterDetails.data;

    return await usageMasterRef.doc(id).update({ crdUsed: creditUsedByNow }).then((result) => {
        return { status: "success", data: { id } };
    }).catch((e) => { return { status: "error", "message": e } });

}

async function getUsageMasterDocId(usageMasterRef, cid) {

    try {
        return await usageMasterRef.where("cid", "==", cid).get()
            .then(snapshot => {

                if (snapshot.empty) {
                    return { status: "error", message: "Credit details not found in usage master" };
                }
                let data;
                snapshot.forEach(doc => {
                    data = doc.data();
                    data.id = doc.id;
                });

                return { status: "success", data };
            })
            .catch(err => {
                console.log('creditsUsedCount error', err);
                return { status: "error", message: err };
            });
    } catch (e) {
        return { status: "error", message: e }
    }

}

async function readUpdateContactsListItem(user_id, nameOfList, resultData) {

    try {

        let reqListCollection = await getUserContactsListItemFileName(user_id, nameOfList);
        if (reqListCollection.status == "error")
            return { status: "error", message: reqListCollection.message };

        let fileName = reqListCollection.fileName;
        // console.log("fileName", fileName);


        //Get file data
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        var file = await storage.bucket(config.get("gcloud_list_storage")).file(fileName);

        let oldFileDataListResult = await readUserContactListItem(file);
        if (oldFileDataListResult.status == "error")
            return { status: "error", message: oldFileDataListResult.message };

        let fileDataList = oldFileDataListResult;
        fileDataList.unshift(resultData);

        //update result in file
        let updateDataResult = writeDataInListCollectionFile(file, fileDataList);
        if (updateDataResult.status == "error")
            return { status: "error", message: updateDataResult.message };

        return { status: "success" };


    } catch (error) {
        console.log("updateContactsListCollection ", error);
        return { status: "error", message: error.message };
    }

}

async function readUserContactListItem(file) {
    try {

        let oldFileDataList = await new Promise(async (res, rej) => {


            try {
                var isExists = await file.exists() || [];
                if (isExists.length > 0 && isExists[0]) {
                    var readF = file.createReadStream();
                    var buf = '';
                    readF.on('data', function (d) {
                        buf += d;
                    }).on('end', function () {
                        res(JSON.parse(buf));

                    });
                } else
                    rej({ status: "error", message: "File does not exist" });
            } catch (error) {
                rej({ status: "error", message: error.message });
            }

        });

        return oldFileDataList;

    } catch (error) {
        console.log("readUserContactListItem error ", error);
        return { status: "error", message: error.message };
    }

}


async function checkMasterDBHasContactResult(req, nameOfList) {

    try {
        const { user_id, cid } = req.user; //middleware
        const { lid } = req.body;
        const { crdUsed, crdMax } = req.credits; //middleware

        var db = admin.firestore();
        var masterContactRef = db.collection("masterContactData");
        return await masterContactRef.where("lid", "==", lid).get()
            .then(async snapshot => {

                if (snapshot.empty)
                    return { status: "error", message: "Could not find the result" };

                let data;
                snapshot.forEach(doc => {
                    data = doc.data();
                    data.docId = doc.id;
                });

                //If contact id is already searched by the user
                if (data.reqids.includes(cid))
                    return { status: "success", data: data.parseData };
                else {

                    //update req id with this cid
                    let reqids = data.reqids;
                    reqids.push(cid);
                    await updateMasterContactResultWithCid(masterContactRef, data.docId, reqids);

                    if (data.parseData.hasOwnProperty("phones"))
                        req.body.contactNumber = data.parseData.phones.join(', ');
                    if (data.parseData.hasOwnProperty("emails"))
                        req.body.emails = data.parseData.emails.join(', ');

                    let updatelistResult = await readUpdateContactsListItem(uid, nameOfList, req.body).catch(e => { throw e });
                    if (updatelistResult.status == "error")
                        return { status: "error", message: updatelistResult.message };

                    //user_id is the company id collection id
                    let creditsUpdateResult = await updateCreditsUsedByOne(cid, (crdUsed + 1)).catch(e => { throw e });
                    if (creditsUpdateResult.status == "error")
                        return { status: "error", message: creditsUpdateResult.message };

                    data.parseData.credits = { crdUsed: crdUsed + 1, crdMax };
                    return { status: "success", data: data.parseData };

                }

            })
            .catch(err => {
                console.log('checkMasterDBHasContactResult error', err);
                return { status: "error", message: err };
            });
    } catch (e) {
        console.log('checkMasterDBHasContactResult try catch error', err);
        return { status: "error", message: e }
    }

}

async function saveMasterContactResult(cid, reqBody, contactResultData, contactAPIOutput) {

    try {

        let saveMasterResultinFile = await saveMasterContactResultinFile(contactAPIOutput);
        if (saveMasterResultinFile.status == "error")
            return { status: "error", message: saveMasterResultinFile.message };

        reqBody.data = saveMasterResultinFile.fileName;
        reqBody.reqids = [cid];
        reqBody.parseData = contactResultData;

        var db = admin.firestore();
        var masterContactRef = db.collection("masterContactData");
        return await masterContactRef.add(reqBody).then((result) => {
            return { status: "success", data: result.id }
        })
            .catch((e) => res.status(400).json(errorOuput(e)));

    } catch (e) {
        console.log('saveMasterContactResult error', e);
        return { status: "error", message: e }
    }
}


async function saveMasterContactResultinFile(data) {

    try {

        /* Write File */
        let uuidv1 = uuid.v1();
        var fileName = `${uuidv1}.json`;


        //Get file data
        const storage = new Storage({ keyFilename: config.get("gcloud_key_file") });
        var file = await storage.bucket(config.get("gcloud_master_contact_storage")).file(fileName);

        return await new Promise((res, rej) => {
            const stream = file.createWriteStream({
                metadata: {
                    contentType: "application/json"
                },
                resumable: false
            });
            stream.on('error', (err) => {
                rej({ status: "error", message: err });
            });
            stream.on('finish', () => {
                res({ status: "success", fileName: fileName });
            });
            stream.end(`${JSON.stringify(data)}`);
        });

    } catch (error) {
        console.log("saveMasterContactResultinFile ", error.message);
        return { status: "error", message: error.message };
    }

}

async function updateMasterContactResultWithCid(masterContactRef, docId, ids) {

    return await masterContactRef.doc(docId).update({ reqids: ids }).then((result) => {
        return { status: "success", data: { id } };
    }).catch((e) => { return { status: "error", "message": e } });

}




async function getUserContactsListItemFileName(user_id, nameOfList) {

    try {
        var db = admin.firestore();
        var listMasterRef = db.collection("listMaster");
        return await listMasterRef.where('uid', "==", user_id).get()
            .then(snapshot => {
                let data = {};
                snapshot.forEach(doc => {
                    data = doc.data();
                });
                return { status: "success", fileName: data.path };
            })
            .catch(err => {
                console.log('getListUserFileName error', err);
                return { status: "error", message: err };
            });
    } catch (error) {
        console.log("getListCollectionFileName ", error);
        return { status: "error", message: error.message };
    }

}



module.exports = router;

