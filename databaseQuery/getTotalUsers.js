const { getCurrentISTTime } = require('../utilities/dateTime');
const admin = require('firebase-admin');

//total user count
const getTotalUsers = async () => {
    const auth = admin.auth();
    let nextPageToken = undefined;
    let totalUser = 0;
    let today = 0;
    let yesterday = 0;
    let last_7_days = 0;
    let this_month = 0;
    let last_month = 0;

    try {
        // Get current timestamps in IST
        const now = getCurrentISTTime();

        // Today Start
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // Yesterday Start and End (Handles case where yesterday was in the previous month)
        let yesterdayDate = new Date(now);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStart = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate()).getTime();
        const yesterdayEnd = todayStart - 1; // Yesterday ends right before today starts

        // Last 7 Days Start (Handles case where part of last 7 days is in the previous month)
        const sevenDaysAgoDate = new Date(now);
        sevenDaysAgoDate.setDate(now.getDate() - 7);
        const sevenDaysAgo = sevenDaysAgoDate.getTime();

        // This Month Start
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        // Last Month Start and End
        let lastMonthDate = new Date(now);
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastMonthStart = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1).getTime();
        const lastMonthEnd = monthStart - 1; // Last month ends right before this month starts

        do {
            // Fetch up to 1000 users at a time
            const listUsersResult = await auth.listUsers(1000, nextPageToken);

            listUsersResult.users.forEach(user => {
                const creationTime = new Date(user.metadata.creationTime).getTime(); // Convert to timestamp

                totalUser++;

                if (creationTime >= todayStart) {
                    today++; // Count users created today
                }
                if (creationTime >= yesterdayStart && creationTime <= yesterdayEnd) {
                    yesterday++; // Count users created yesterday
                }
                if (creationTime >= sevenDaysAgo) {
                    last_7_days++; // Count users created in last 7 days
                }
                if (creationTime >= monthStart) {
                    this_month++; // Count users created in this month
                }
                if (creationTime >= lastMonthStart && creationTime <= lastMonthEnd) {
                    last_month++; // Count users created in last month
                }
            });

            nextPageToken = listUsersResult.pageToken || null; // Set next page token
        } while (nextPageToken);

    } catch (error) {
        console.error("Error retrieving total users: ", error);
    }

    return {
        totalUser,
        today,
        yesterday,
        last_7_days,
        this_month,
        last_month
    };
}

module.exports = { getTotalUsers };