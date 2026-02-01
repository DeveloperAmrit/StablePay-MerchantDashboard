"use client"

import { Bell, RefreshCw, Filter, Search, Shield, MapPin, Clock, MoreVertical, X, ExternalLink, Calendar } from "lucide-react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import DashboardPageLayout from "@/components/dashboard/layout"
import CreditCardIcon from "@/components/icons/credit-card"
import { useTransactions } from "@/hooks/use-transactions"
import { NETWORKS } from "@/lib/config"

// Helper function to format address
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper function to get explorer URL for a transaction
const getExplorerUrl = (chainId: number, txHash: string): string => {
  const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
  if (network?.explorerUrl) {
    return `${network.explorerUrl}/tx/${txHash}`;
  }
  return `https://sepolia.etherscan.io/tx/${txHash}`;
};

// Helper function to get risk level based on amount
const getRiskLevel = (amount: string) => {
  const numAmount = parseFloat(amount);
  if (numAmount > 100) return "high";
  if (numAmount > 50) return "medium";
  return "low";
};

// Helper function to format date for input
const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Interface for filter criteria
interface FilterCriteria {
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  status: string[];
  riskLevel: string[];
}

export default function TransactionsPage() {
  const { transactions, loading, error, hasFetched, fetchTransactions, clearCache } = useTransactions();
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  
  // Filter state
  const [filters, setFilters] = useState<FilterCriteria>({
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
    status: [],
    riskLevel: []
  });

  // Apply all filters
  const filteredTransactions = transactions.filter((transaction) => {
    // Search query filter
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      transaction.transactionHash.toLowerCase().includes(query) ||
      transaction.buyer.toLowerCase().includes(query) ||
      transaction.receiver.toLowerCase().includes(query) ||
      transaction.amountSC.toLowerCase().includes(query);
    
    if (!matchesSearch) return false;

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      const txDate = transaction.timestamp ? new Date(transaction.timestamp) : null;
      if (txDate) {
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          if (txDate < fromDate) return false;
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire day
          if (txDate > toDate) return false;
        }
      }
    }

    // Amount range filter (using amountSC)
    const amount = parseFloat(transaction.amountSC);
    if (filters.amountMin && amount < parseFloat(filters.amountMin)) return false;
    if (filters.amountMax && amount > parseFloat(filters.amountMax)) return false;

    // Status filter (all blockchain transactions are completed)
    if (filters.status.length > 0 && !filters.status.includes("completed")) {
      return false;
    }

    // Risk level filter
    if (filters.riskLevel.length > 0) {
      const risk = getRiskLevel(transaction.amountSC);
      if (!filters.riskLevel.includes(risk)) return false;
    }

    return true;
  });

  const handleResetFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
      status: [],
      riskLevel: []
    });
  };

  const handleToggleStatus = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }));
  };

  const handleToggleRiskLevel = (risk: string) => {
    setFilters(prev => ({
      ...prev,
      riskLevel: prev.riskLevel.includes(risk)
        ? prev.riskLevel.filter(r => r !== risk)
        : [...prev.riskLevel, risk]
    }));
  };

  const hasActiveFilters = 
    filters.dateFrom || 
    filters.dateTo || 
    filters.amountMin || 
    filters.amountMax || 
    filters.status.length > 0 || 
    filters.riskLevel.length > 0;

  const filteredTransactions = transactions.filter((transaction) => {
    const query = searchQuery.toLowerCase();
    return (
      transaction.transactionHash.toLowerCase().includes(query) ||
      transaction.buyer.toLowerCase().includes(query) ||
      transaction.receiver.toLowerCase().includes(query) ||
      transaction.amountSC.toLowerCase().includes(query)
    );
  });
  
  const transactionStats = useMemo(() => {
    return {
      total: transactions.length,
    };
  }, [transactions]);

  const handleRowClick = (transaction: (typeof transactions)[0]) => {
    setSelectedTransaction(transaction)
    setIsModalOpen(true)
  }

  return (
    <DashboardPageLayout
      header={{
        title: "Transactions",
        description: "Manage and monitor payment operations",
        icon: CreditCardIcon,
      }}
    >
      <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-border/40">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">StablePay</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-primary">TRANSACTIONS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground hidden md:inline">
            LAST UPDATE:{" "}
            {new Date().toLocaleString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })}{" "}
            UTC
          </span>
          <Button variant="ghost" size="icon" className="size-8">
            <Bell className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-8 py-8 overflow-auto">
        {/* Title Section */}
        <div className="flex flex-col md:flex-row items-start justify-between mb-8 gap-4 md:gap-0">
          <div>
            <h1 className="text-4xl font-serif mb-2">Transaction Network</h1>
            <p className="text-muted-foreground">Manage and monitor payment operations</p>
          </div>
          <div className="flex gap-3">
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground relative"
              onClick={() => setIsFilterOpen(true)}
            >
              <Filter className="size-4 mr-2" />
              Filter
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 size-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
                  {[filters.dateFrom, filters.dateTo, filters.amountMin, filters.amountMax].filter(Boolean).length + 
                   filters.status.length + filters.riskLevel.length}
                </span>
              )}
            </Button>
            {!hasFetched ? (
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground" 
                onClick={fetchTransactions} 
                disabled={loading}
              >
                <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'See Transactions'}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="secondary" 
                  onClick={fetchTransactions} 
                  disabled={loading}
                >
                  <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh Data'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={clearCache}
                  className="text-xs"
                >
                  Clear Cache
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Search Card */}
          <div className="bg-card border border-border/40 rounded-lg p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search transactions" className="pl-10 bg-background/50 border-border/40" />
            </div>
          </div>

          {/* Active Transactions */}
          <div className="bg-card border border-border/40 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  {hasActiveFilters || searchQuery ? "FILTERED RESULTS" : "TOTAL TRANSACTIONS"}
                </div>
                <div className="text-4xl font-bold">
                  {loading ? "..." : filteredTransactions.length}
                  {hasActiveFilters || searchQuery ? (
                    <span className="text-base text-muted-foreground ml-2">/ {transactions.length}</span>
                  ) : null}
                </div>
              </div>
              <Shield className="size-8 text-foreground" />
            </div>
          </div>

          {/* Failed */}
          <div className="bg-card border border-border/40 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-2">FAILED</div>
                <div className="text-4xl font-bold text-red-500">0</div>
              </div>
              <Shield className="size-8 text-red-500" />
            </div>
          </div>

          {/* Pending */}
          <div className="bg-card border border-border/40 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground mb-2">PENDING</div>
                <div className="text-4xl font-bold text-primary">0</div>
              </div>
              <Shield className="size-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-card border border-border/40 rounded-lg overflow-hidden flex-1 flex flex-col">
          <div className="p-6 border-b border-border/40">
            <h2 className="text-xl font-serif">TRANSACTION ROSTER</h2>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full min-w-full h-full">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-32">TRANSACTION ID</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-40">BUYER</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-40">RECEIVER</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-24">STATUS</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-32">BLOCK</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-28">BLOCKCHAIN</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-24">AMOUNT SC</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-24">RISK</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground w-20">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                      Loading transactions from blockchain...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-red-500">
                      Error: {error}
                    </td>
                  </tr>
                ) : transactionStats.total === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                      {!hasFetched ? "Click 'See Transactions' to load blockchain data" : "No StableCoin purchase events found"}
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction, index) => (
                    <tr
                      key={transaction.transactionHash}
                      onClick={() => handleRowClick(transaction)}
                      className="border-b border-border/40 hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono whitespace-nowrap">{formatAddress(transaction.transactionHash)}</td>
                      <td className="px-6 py-4 font-mono whitespace-nowrap">{formatAddress(transaction.buyer)}</td>
                      <td className="px-6 py-4 font-mono whitespace-nowrap">{formatAddress(transaction.receiver)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-green-500" />
                          <span className="uppercase text-sm">completed</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <MapPin className="size-4 text-muted-foreground" />
                          #{transaction.blockNumber.toString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-foreground">
                        {transaction.networkName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 font-mono whitespace-nowrap">{transaction.amountSC} SC</td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="secondary"
                          className={`uppercase ${
                            getRiskLevel(transaction.amountSC) === "high"
                              ? "bg-primary/20 text-primary border-primary/40"
                              : getRiskLevel(transaction.amountSC) === "medium"
                                ? "bg-muted text-muted-foreground"
                                : "bg-green-500/20 text-green-500 border-green-500/40"
                          }`}
                        >
                          {getRiskLevel(transaction.amountSC)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="size-8" 
                          onClick={(e) => {
                            e.stopPropagation();
                            const explorerUrl = getExplorerUrl(transaction.chainId, transaction.transactionHash);
                            window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
                {/* Empty rows to fill remaining space */}
                {Array.from({ length: 10 }).map((_, index) => (
                  <tr key={`empty-${index}`} className="border-b border-border/40">
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter Dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">Filter Transactions</DialogTitle>
            <p className="text-sm text-muted-foreground">Apply filters to narrow down your transaction list</p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Date Range Filter */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <Label className="text-base font-medium">Date Range</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom" className="text-sm text-muted-foreground">From Date</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo" className="text-sm text-muted-foreground">To Date</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="bg-background/50 border-border/40"
                  />
                </div>
              </div>
            </div>

            {/* Amount Range Filter */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Amount Range (SC)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amountMin" className="text-sm text-muted-foreground">Minimum Amount</Label>
                  <Input
                    id="amountMin"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={filters.amountMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, amountMin: e.target.value }))}
                    className="bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amountMax" className="text-sm text-muted-foreground">Maximum Amount</Label>
                  <Input
                    id="amountMax"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={filters.amountMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, amountMax: e.target.value }))}
                    className="bg-background/50 border-border/40"
                  />
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Transaction Status</Label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={filters.status.includes("completed") ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => handleToggleStatus("completed")}
                >
                  <div className="size-2 rounded-full bg-green-500 mr-2" />
                  Completed
                </Badge>
                <Badge
                  variant={filters.status.includes("pending") ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => handleToggleStatus("pending")}
                >
                  <div className="size-2 rounded-full bg-yellow-500 mr-2" />
                  Pending
                </Badge>
                <Badge
                  variant={filters.status.includes("failed") ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => handleToggleStatus("failed")}
                >
                  <div className="size-2 rounded-full bg-red-500 mr-2" />
                  Failed
                </Badge>
              </div>
            </div>

            {/* Risk Level Filter */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Risk Level</Label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={filters.riskLevel.includes("low") ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2 ${
                    filters.riskLevel.includes("low")
                      ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
                      : "bg-green-500/20 text-green-500 border-green-500/40 hover:bg-green-500/30"
                  }`}
                  onClick={() => handleToggleRiskLevel("low")}
                >
                  Low Risk
                </Badge>
                <Badge
                  variant={filters.riskLevel.includes("medium") ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2 ${
                    filters.riskLevel.includes("medium")
                      ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                      : "bg-orange-500/20 text-orange-500 border-orange-500/40 hover:bg-orange-500/30"
                  }`}
                  onClick={() => handleToggleRiskLevel("medium")}
                >
                  Medium Risk
                </Badge>
                <Badge
                  variant={filters.riskLevel.includes("high") ? "default" : "outline"}
                  className={`cursor-pointer px-4 py-2 ${
                    filters.riskLevel.includes("high")
                      ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                      : "bg-primary/20 text-primary border-primary/40 hover:bg-primary/30"
                  }`}
                  onClick={() => handleToggleRiskLevel("high")}
                >
                  High Risk
                </Badge>
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-border/40">
            <Button 
              variant="ghost" 
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
            >
              Clear All Filters
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsFilterOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setIsFilterOpen(false)}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/40">
          <DialogHeader className="relative">
            <DialogTitle className="text-3xl font-display mb-2">{selectedTransaction?.merchant}</DialogTitle>
            <p className="text-muted-foreground font-mono">{selectedTransaction?.id}</p>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0"
              onClick={() => setIsModalOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-8 py-6">
            <div className="space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-2">STATUS</div>
                <div className="flex items-center gap-2">
                  <div
                    className={`size-2 rounded-full ${
                      selectedTransaction?.status === "completed"
                        ? "bg-green-500"
                        : selectedTransaction?.status === "pending"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                  />
                  <span className="uppercase text-lg">{selectedTransaction?.status}</span>
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">MISSIONS COMPLETED</div>
                <div className="text-2xl font-bold">{selectedTransaction?.amount}</div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-2">LOCATION</div>
                <div className="text-lg">{selectedTransaction?.location}</div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">RISK LEVEL</div>
                <Badge
                  variant="secondary"
                  className={`uppercase text-sm px-3 py-1 ${
                    selectedTransaction?.risk === "high"
                      ? "bg-primary/20 text-primary border-primary/40"
                      : selectedTransaction?.risk === "medium"
                        ? "bg-muted text-muted-foreground"
                        : "bg-red-500/20 text-red-500 border-red-500/40"
                  }`}
                >
                  {selectedTransaction?.risk}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border/40">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Assign Mission</Button>
            <Button variant="outline" className="border-border/40 bg-transparent">
              View History
            </Button>
            <Button variant="outline" className="border-border/40 bg-transparent">
              Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardPageLayout>
  )
}
