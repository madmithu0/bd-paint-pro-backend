/**
 * maintenanceModeService.js
 * ফিচারসমূহ: Maintenance Mode, Government Notice, এবং 28 Kill Switch Control
 */

// সিস্টেমের গ্লোবাল স্টেট (মেমোরিতে রাখার জন্য, প্রোডাকশনে এটি Redis বা ডাটাবেজে রাখা ভালো)
let systemState = {
  isMaintenanceMode: false,
  maintenanceMessage: "Our system is currently undergoing scheduled maintenance. Please check back later.",
  
  isGovtNoticeActive: false,
  govtNoticeContent: {
    title: "সরকারি নির্দেশনা",
    body: "জাতীয় নিরাপত্তা অথবা সরকারি নির্দেশনাক্রমে এই সার্ভিসটি সাময়িকভাবে নিয়ন্ত্রিত করা হয়েছে।",
    publishDate: null
  },
  
  // কিল সুইচ স্টেট (ছবিতে উল্লেখিত '28 kill switch control' বা মোট ২৮টি ভিন্ন সার্ভিসের ইন্ডিভিজুয়াল কন্ট্রোল)
  killSwitches: {
    1: { name: "User Registration", isActive: true },
    2: { name: "Payment Gateway", isActive: true },
    3: { name: "Chat System", isActive: true },
    4: { name: "Live Tracking", isActive: true },
    5: { name: "File Upload", isActive: true },
    6: { name: "Notifications", isActive: true },
    7: { name: "SMS Gateway", isActive: true },
    8: { name: "Email Service", isActive: true },
    9: { name: "API V1 Access", isActive: true },
    10: { name: "API V2 Access", isActive: true },
    // ... এভাবে মোট ২৮টি সার্ভিস বা ফিচারের জন্য আলাদা আলাদা কিল সুইচ কন্ট্রোল করা যাবে
    28: { name: "Admin Remote Access", isActive: true }
  }
};

module.exports = {
  // ১. মেইনটেন্যান্স মোড কন্ট্রোল (Maintenance Mode)
  setMaintenanceMode: (status, customMessage = null) => {
    systemState.isMaintenanceMode = status;
    if (customMessage) {
      systemState.maintenanceMessage = customMessage;
    }
    return { success: true, isMaintenanceMode: systemState.isMaintenanceMode };
  },

  getMaintenanceStatus: () => {
    return {
      isMaintenanceMode: systemState.isMaintenanceMode,
      message: systemState.maintenanceMessage
    };
  },

  // ২. সরকারি নোটিশ কন্ট্রোল (Govt Notice)
  setGovtNotice: (status, title = null, body = null) => {
    systemState.isGovtNoticeActive = status;
    if (status) {
      systemState.govtNoticeContent.title = title || systemState.govtNoticeContent.title;
      systemState.govtNoticeContent.body = body || systemState.govtNoticeContent.body;
      systemState.govtNoticeContent.publishDate = new Date();
    }
    return { success: true, isGovtNoticeActive: systemState.isGovtNoticeActive };
  },

  getGovtNotice: () => {
    return {
      isGovtNoticeActive: systemState.isGovtNoticeActive,
      notice: systemState.isGovtNoticeActive ? systemState.govtNoticeContent : null
    };
  },

  // ৩. ২৮টি কিল সুইচ কন্ট্রোল লজিক (28 Kill Switch Control)
  toggleKillSwitch: (switchId, status) => {
    const id = parseInt(switchId);
    if (id < 1 || id > 28 || !systemState.killSwitches[id]) {
      throw new Error("Invalid Kill Switch ID. Must be between 1 and 28.");
    }
    
    systemState.killSwitches[id].isActive = status;
    return { 
      success: true, 
      switchId: id, 
      serviceName: systemState.killSwitches[id].name, 
      isActive: systemState.killSwitches[id].isActive 
    };
  },

  isServiceAvailable: (switchId) => {
    const id = parseInt(switchId);
    // যদি মেইনটেন্যান্স মোড বা সরকারি নোটিশ চালু থাকে, তাহলে পুরো সিস্টেম অফ থাকবে
    if (systemState.isMaintenanceMode || systemState.isGovtNoticeActive) {
      return false;
    }
    // নির্দিষ্ট সার্ভিসের কিল সুইচ একটিভ (true) থাকলে সার্ভিস পাওয়া যাবে, ইন-একটিভ (false) থাকলে কিল বা বন্ধ থাকবে
    return systemState.killSwitches[id] ? systemState.killSwitches[id].isActive : false;
  },

  getAllKillSwitches: () => {
    return systemState.killSwitches;
  },

  // ৪. এক্সপ্রেস মিডলওয়্যার (API রাউটে চেক করার জন্য)
  maintenanceMiddleware: (req, res, next) => {
    if (systemState.isMaintenanceMode) {
      return res.status(503).json({
        status: "MAINTENANCE_MODE",
        message: systemState.maintenanceMessage
      });
    }
    if (systemState.isGovtNoticeActive) {
      return res.status(451).json({ // 451 Status Code: Unavailable For Legal Reasons
        status: "GOVT_NOTICE_RESTRICTION",
        details: systemState.govtNoticeContent
      });
    }
    next();
  }
};
