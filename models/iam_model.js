const admin = require('firebase-admin');
const uuid = require('uuid');
const uniqid = require('uniqid');
const timestamp = require('unix-timestamp');

const db = admin.firestore();


async function initiateRole(req) {


    let { uid, cid, rol } = req;

    let check = await checkCollection('uid', uid, 'roleMain');

    if (check) {
        let uuidv1 = uuid.v1();
        let lid = uuidv1.substr(0, 16);
        let input = {
            uid: uid,
            cid: cid,
            rol: rol
        }
        await db.collection('roleMain').doc(lid)
            .set(input);
        return input;

    } else {
        return ({
            Error: {
                Msg: "This userId already exists"
            }
        })
    }

}

async function updateRole(req) {

    let { uid, rol } = req;

    const collectionRef = db.collection('roleMain')
        .where('uid', '==', uid);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        return ({
            Error: {
                Msg: "This userId does not exist"
            }
        })
    } else {
        const data = snapshot.docs[0].data();
        const cid = data.cid;
        const id = snapshot.docs[0].id;
        const document = db.collection('roleMain').doc(id);
        await document.update({
            rol: rol
        });
        return {
            uid: uid,
            cid: cid,
            rol: rol
        };

    }

}

//This API is called when an existing user’s cid has to be updated
async function changeCompanyForUser(req) {

    let { uid, cid_new } = req;
    const collectionRef = db.collection('roleMain');

    const snapshot = await collectionRef
        .where('uid', '==', uid)
        .get();

    let docs = snapshot.docs;
    let docArray = []

    docs.forEach(element => {
        let data = element.data();
        docArray.push({
            id: element.id,
            rol: data.rol
        });
    })

    if (docArray.length == 0) {
        return ({
            Error: { Msg: "User doesn’t exist" }
        })
    } else {
        const response = await changeCompanyMultiple(docArray, cid_new, uid);
        console.log("responses", response);
        return response;
    }

}

async function changeCompanyMultiple(inputArray, cid, uid) {
    let promiseArray = [];
    inputArray.forEach(element => {
        promiseArray.push(changeCompany(cid, uid, element.rol, element.id));
    })
    const responses = await Promise.all(promiseArray).then(response => {
        return response
    }).catch(err => {
        throw err;
    });
    return responses;
}

async function changeCompany(cid, uid, rol, docId) {

    const document = db.collection('roleMain').doc(docId);
    const updateBody = {
        cid: cid
    };
    await document.update(updateBody);
    return {
        cid: cid,
        uid: uid,
        rol: rol
    };
}

async function checkCollection(column, value, collectionName) {

    let check = false;
    const collectionRef = db.collection(collectionName);
    console.log('ChecklistId', value);
    // Create a query against the collection
    try {
        console.log('step1');
        const snapshot = await collectionRef.where(column, '==', value).get();
        console.log('step2');
        if (snapshot.empty) {
            check = true;
            console.log('step3');
        }
    } catch (error) {
        console.log('error', error);
        console.log('step4');
        throw error;
    }

    console.log(check);
    return check;
}

async function addInvite(req) {

    try {

        let { cid, senderId, fName, lName, email, type, role, tierId } = req;

        const invid = uniqid.process();
        const joined = false;
        const today = new Date();

        let inputBody = {
            cid: cid,
            sendid: senderId,
            fn: fName,
            ln: lName,
            eml: email,
            type: type,
            rol: role,
            tierId: tierId,
            joined: joined,
            joinDate: null,
            invid: invid,
            invDate: today
        }

        let check = await checkCollection('invid', invid, 'inviteMain');
        if (check) {
            await db.collection('inviteMain').doc(invid)
                .set(inputBody);
            return inputBody;
        } else {
            return {
                Error: {
                    Msg: "invitation exists"
                }
            }

        }

    } catch (error) {
        console.log('addInvite', error.message);
        return ({
            Error:
            {
                Msg: "Firebase error in addInvite"
            }
        });
    }
}

async function getInviteDetail(req) {

    let { invitationId } = req;

    const collectionRef = db.collection('inviteMain')
        .where('invid', '==', invitationId);

    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        return ({
            Error: {
                Msg: "This invitation does not exist"
            }
        })
    } else {
        const data = [];

        snapshot.docs.forEach(element => {
            data.push(element.data());
        });

        return (data.length == 1 ? data[0] : data);
    }

}

async function confirmUserJoined(req) {

    let { invitationId } = req;

    const collectionRef = db.collection('inviteMain')
        .where('invid', '==', invitationId);

    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        return ({
            Error: {
                Msg: "This invitation does not exist"
            }
        })
    } else {

        const invitationObject = snapshot.docs[0].data();
        const id = snapshot.docs[0].id;
        const today = new Date();
        const document = db.collection('inviteMain').doc(id);
        await document.update({
            joined: true,
            joinDate: today
        });

        invitationObject.joined = true;
        invitationObject.joinDate = today;

        return invitationObject;

    }
}

module.exports = {

    initiateRole: async function (req) {
        let response = await initiateRole(req);
        return response;
    },

    updateRole: async function (req) {
        let response = await updateRole(req);
        return response;
    },

    changeCompanyForUser: async function (req) {
        let response = await changeCompanyForUser(req);
        return response;
    },

    addInvite: async function (req) {
        let response = await addInvite(req);
        return response;
    },

    getInviteDetail: async function (req) {
        let response = await getInviteDetail(req);
        return response;
    },

    confirmUserJoined: async function (req) {
        let response = await confirmUserJoined(req);
        return response;
    }
}