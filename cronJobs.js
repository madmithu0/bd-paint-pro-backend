/**
 * cronJobs.js
 * 
 * এই ফাইলটি অ্যাপ্লিকেশনের সমস্ত শিডিউলড টাস্ক (Cron Jobs), অটো-হিলিং,
 * এবং ২৬ নং ফাইলের সাথে সংযুক্ত হয়ে ক্র্যাশ ডিটেকশন ও রিস্টোর ট্রিগার পরিচালনা করে।
 */

const cron = require('node-cron');
const backupRestore = require('./backupRestore'); // ২৬ নং ফাইলের সাথে কানেকশন

const taskQueue = [];

// সিস্টেমের লাইভ স্ট্যাটাস ট্র্যাকিং অবজেক্ট
let systemStatus = {
    crashDetect: false,
    healthFail: false
};

/**
 * মনিটরিং হেল্পার ফাংশন (সার্ভার হেলথ চেক)
 */
function checkSystemHealth() {
    // বাস্তব প্রজেক্টে এখানে মেমোরি, ডাটাবেজ কানেকশন বা এপিআই রেসপন্স চেক হবে
    return false; // ফলস মানে কোনো কারণে সমস্যা বা ক্র্যাশ হয়েছে
}

/**
 * ১, ২ ও ৩. অটো-হিলিং, রিস্টার্ট মনিটর এবং হেলথ পিং (Every 2 Seconds)
 */
cron.schedule('*/2 * * * * *', () => {
    try {
        const isHealthy = checkSystemHealth();
        
        if (!isHealthy) {
            systemStatus.crashDetect = true;
            systemStatus.healthFail = true;
            
            console.error('[Cron Alert] System failure detected! Sending signal to backupRestore...');
            
            // ২৬ নং ফাইলের ২ সেকেন্ডের অটো-রিস্টোর ফাংশন সরাসরি কল করা হলো
            backupRestore.handleCrashOrHealthFailure(systemStatus);
            
            // বারবার ট্রিগার হওয়া আটকাতে সিগন্যাল রিসেট
            systemStatus.crashDetect = false;
            systemStatus.healthFail = false;
        }
    } catch (error) {
        console.error('[Cron Health Monitor Error]:', error.message);
    }
});

/**
 * ৪. ইনক্রিমেন্টাল ডেটা ব্যাকআপ (Every 10 Minutes)
 */
cron.schedule('*/10 * * * *', () => {
    try {
        console.log('[Cron] Initiating 10-minute incremental backup...');
        const currentDataPayload = { timestamp: new Date(), status: "Active System Snapshot" };
        
        // ২৬ নং ফাইলের এনক্রিপশন ও র‍্যাম ব্যাকআপ ফাংশনে ডেটা পাঠানো হচ্ছে
        backupRestore.incrementalBackup(currentDataPayload);
    } catch (error) {
        console.error('[Cron Incremental Backup Error]:', error.message);
    }
});

/**
 * ৫. ৬ ঘণ্টার ফুল ব্যাকআপ ক্রন (Every 6 Hours)
 */
cron.schedule('0 */6 * * *', () => {
    try {
        console.log('[Cron] Running 6-Hour full system backup...');
        const entireDatabaseDump = { info: "Full Production DB Dump" };
        
        backupRestore.full6HourBackup(entireDatabaseDump);
    } catch (error) {
        console.error('[Cron Full Backup Error]:', error.message);
    }
});

/**
 * ৬. কোড ব্যাকআপ ও গিট অটো-পুশ (Every 10 Minutes)
 */
cron.schedule('*/10 * * * *', () => {
    try {
        console.log('[Cron] Executing code backup and git push...');
        // exec('git add . && git commit -m "Auto-backup" && git push origin main')
    } catch (error) {
        console.error('[Cron Git Auto Push Error]:', error.message);
    }
});

/**
 * ৭. হ্যাক আইপি ব্ল্যাকলিস্ট ক্রন (Every 1 Minute)
 */
cron.schedule('* * * * *', () => {
    try {
        // সন্দেহভাজন আইপি ডাটাবেজ থেকে নিয়ে ফায়ারওয়ালে ব্লক করার লজিক
    } catch (error) {
        console.error('[Cron IP Blacklist Error]:', error.message);
    }
});

/**
 * ৮. ৫ বছরের আর্কাইভ ম্যানেজমেন্ট (প্রতি মাসের ১ তারিখে)
 */
cron.schedule('0 0 1 * *', () => {
    try {
        console.log('[Cron] Archiving outdated database records to long term storage...');
    } catch (error) {
        console.error('[Cron Archive Error]:', error.message);
    }
});

module.exports = { 
    taskQueue,
    systemStatus 
};
