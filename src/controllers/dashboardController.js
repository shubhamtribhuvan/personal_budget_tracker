const Transaction = require("../models/transactionModel");
const Budget = require("../models/budgetModel");
const { createResponse } = require("../services/responseService");
const mongoose = require("mongoose");

// Get financial summary
exports.getSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    let { period, startDate, endDate } = req.query;

    // Set date range based on period
    const today = new Date();
    let start, end;

    if (startDate && endDate) {
      // Custom date range
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default period handling
      switch (period) {
        case "week":
          // Start from last Sunday (or today if it's Sunday)
          const day = today.getDay(); // 0 is Sunday
          start = new Date(today);
          start.setDate(today.getDate() - day);
          start.setHours(0, 0, 0, 0);
          end = new Date(today);
          break;
          
        case "month":
          // Current month
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today);
          break;
          
        case "year":
          // Current year
          start = new Date(today.getFullYear(), 0, 1);
          end = new Date(today);
          break;
          
        case "all":
          // All time - no date filtering
          start = null;
          end = null;
          break;
          
        default:
          // Default to current month
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          end = new Date(today);
          period = "month";
          break;
      }
    }

    // Build date filter if applicable
    const dateFilter = {};
    if (start && end) {
      dateFilter.date = { $gte: start, $lte: end };
    }

    // Get total income
   
    const incomeTotal = await Transaction.aggregate([
      {
        $match: {
          user:  new mongoose.Types.ObjectId(req.user.id),
          type: "income",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Get total expenses
    const expenseTotal = await Transaction.aggregate([
      {
        $match: {
          user:  new mongoose.Types.ObjectId(req.user.id),
          type: "expense",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Get breakdown by category
    const categoryBreakdown = await Transaction.aggregate([
      {
        $match: {
          user:  new mongoose.Types.ObjectId(req.user.id),
          ...dateFilter,
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $unwind: "$categoryDetails",
      },
      {
        $group: {
          _id: {
            categoryId: "$category",
            type: "$type",
          },
          total: { $sum: "$amount" },
          name: { $first: "$categoryDetails.name" },
          color: { $first: "$categoryDetails.color" },
        },
      },
      {
        $project: {
          _id: 0,
          categoryId: "$_id.categoryId",
          type: "$_id.type",
          name: 1,
          color: 1,
          total: 1,
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);

    // Get daily totals for trend analysis
    const dailyTotals = await Transaction.aggregate([
      {
        $match: {
          user:  new mongoose.Types.ObjectId(req.user.id),
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            type: "$type",
          },
          total: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          type: "$_id.type",
          total: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    // Get budget vs actual for current month (if period is month)
    let budgetComparison = [];
    if (period === "month" || (startDate && endDate)) {
      // Get the month and year for budget comparison
      const comparisonMonth = start.getMonth() + 1; // 1-12
      const comparisonYear = start.getFullYear();

      // Get all budgets for this month
      const budgets = await Budget.find({
        user: userId,
        month: comparisonMonth,
        year: comparisonYear,
      }).populate("category", "name color");

      // Get actual expenses by category for this month
      const actualExpenses = await Transaction.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(req.user.id),
            type: "expense",
            date: {
              $gte: new Date(comparisonYear, comparisonMonth - 1, 1),
              $lte: new Date(comparisonYear, comparisonMonth, 0),
            },
          },
        },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
          },
        },
      ]);

      // Create a map for fast lookup
      const expenseMap = actualExpenses.reduce((map, item) => {
        map[item._id.toString()] = item.total;
        return map;
      }, {});

      // Build the comparison data
      budgetComparison = budgets.map((budget) => {
        const categoryId = budget.category._id.toString();
        const actual = expenseMap[categoryId] || 0;
        return {
          categoryId,
          categoryName: budget.category.name,
          color: budget.category.color,
          budgeted: budget.amount,
          actual,
          remaining: budget.amount - actual,
          percentUsed: actual / budget.amount * 100,
        };
      });
    }

    // Calculate recent transactions (last 5)
    const recentTransactions = await Transaction.find({ user: userId })
      .sort({ date: -1 })
      .limit(5)
      .populate("category", "name color type");

    // Format the response
    return res.status(200).json(
      createResponse(200, "Financial summary retrieved successfully", {
        summary: {
          income: incomeTotal.length > 0 ? incomeTotal[0].total : 0,
          expense: expenseTotal.length > 0 ? expenseTotal[0].total : 0,
          balance: (incomeTotal.length > 0 ? incomeTotal[0].total : 0) - 
                  (expenseTotal.length > 0 ? expenseTotal[0].total : 0),
        },
        period: {
          name: period,
          startDate: start ? start.toISOString() : null,
          endDate: end ? end.toISOString() : null,
        },
        categoryBreakdown: {
          income: categoryBreakdown.filter(item => item.type === "income"),
          expense: categoryBreakdown.filter(item => item.type === "expense"),
        },
        trends: dailyTotals.reduce((acc, item) => {
          if (!acc[item.date]) {
            acc[item.date] = { date: item.date, income: 0, expense: 0 };
          }
          acc[item.date][item.type] = item.total;
          return acc;
        }, {}),
        budgetComparison,
        recentTransactions: recentTransactions.map(t => ({
          id: t._id,
          amount: t.amount,
          description: t.description,
          type: t.type,
          date: t.date,
          category: {
            id: t.category._id,
            name: t.category.name,
            color: t.category.color,
          },
        })),
      })
    );
  } catch (error) {
    console.error("Get summary error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Get monthly overview
exports.getMonthlyOverview = async (req, res) => {
  try {
    const userId = req.user.id;
    let { year } = req.query;
    
    // Default to current year if not specified
    year = parseInt(year) || new Date().getFullYear();
    
    // Get monthly totals for income and expenses
    const monthlyTotals = await Transaction.aggregate([
      {
        $match: {
          user:  new mongoose.Types.ObjectId(req.user.id),
          date: {
            $gte: new Date(year, 0, 1),
            $lte: new Date(year, 11, 31, 23, 59, 59),
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$date" },
            type: "$type",
          },
          total: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          month: "$_id.month",
          type: "$_id.type",
          total: 1,
        },
      },
      {
        $sort: { month: 1 },
      },
    ]);
    
    // Transform the data for easier consumption
    const months = Array(12).fill().map((_, i) => i + 1);
    const overview = months.map(month => {
      const income = monthlyTotals.find(item => item.month === month && item.type === "income");
      const expense = monthlyTotals.find(item => item.month === month && item.type === "expense");
      
      return {
        month,
        monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
        income: income ? income.total : 0,
        expense: expense ? expense.total : 0,
        balance: (income ? income.total : 0) - (expense ? expense.total : 0),
      };
    });
    
    // Get year totals
    const yearTotals = overview.reduce(
      (acc, month) => ({
        income: acc.income + month.income,
        expense: acc.expense + month.expense,
        balance: acc.balance + month.balance,
      }),
      { income: 0, expense: 0, balance: 0 }
    );
    
    return res.status(200).json(
      createResponse(200, "Monthly overview retrieved successfully", {
        year,
        overview,
        totals: yearTotals,
      })
    );
  } catch (error) {
    console.error("Get monthly overview error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};

// Get category analysis
exports.getCategoryAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;
    let { period, type } = req.query;
    
    // Default to expense if type not specified or invalid
    if (!type || (type !== "income" && type !== "expense")) {
      type = "expense";
    }
    
    // Set date range based on period
    const today = new Date();
    let start, end;
    
    switch (period) {
      case "month":
        // Current month
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today);
        break;
        
      case "year":
        // Current year
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today);
        break;
        
      case "all":
        // All time - no date filtering
        start = null;
        end = null;
        break;
        
      default:
        // Default to current month
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today);
        period = "month";
        break;
    }
    
    // Build date filter if applicable
    const dateFilter = {};
    if (start && end) {
      dateFilter.date = { $gte: start, $lte: end };
    }
    
    // Get totals by category
    const categoryAnalysis = await Transaction.aggregate([
      {
        $match: {
          user:  new mongoose.Types.ObjectId(req.user.id),
          type,
          ...dateFilter,
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $unwind: "$categoryDetails",
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          name: { $first: "$categoryDetails.name" },
          color: { $first: "$categoryDetails.color" },
        },
      },
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          name: 1,
          color: 1,
          total: 1,
          count: 1,
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);
    
    // Calculate totals and percentages
    const totalAmount = categoryAnalysis.reduce((sum, cat) => sum + cat.total, 0);
    
    const analysisWithPercentage = categoryAnalysis.map(cat => ({
      ...cat,
      percentage: totalAmount > 0 ? (cat.total / totalAmount * 100).toFixed(2) : 0,
    }));
    
    return res.status(200).json(
      createResponse(200, "Category analysis retrieved successfully", {
        period,
        type,
        totalAmount,
        categories: analysisWithPercentage,
      })
    );
  } catch (error) {
    console.error("Get category analysis error:", error);
    return res.status(500).json(createResponse(500, "Server error"));
  }
};