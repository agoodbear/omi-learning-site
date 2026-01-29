"use client";

import { useEffect, useState } from "react";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from "recharts";
import { getAdminChartsData } from "@/app/actions/getAdminCharts";
import { useAuth } from "@/lib/auth/AuthContext";
import { Loader2 } from "lucide-react";

export default function AdminCharts() {
    const { user } = useAuth();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) return;

        async function load() {
            try {
                const res = await getAdminChartsData(user!.uid);
                if (res.success && res.data) {
                    setData(res.data);
                }
            } catch (err: any) {
                console.error(err);
                setError("Failed to load chart data");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user]);

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>; // "Failed to load chart data" could be translated in error string, but usually error comes from backend or catch block.
    if (data.length === 0) return <div className="p-4 text-muted text-sm">近期無活動數據</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Activity Trend */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">過去30天活動趨勢</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                tickFormatter={(val) => val.slice(5)} // Show MM-DD
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />

                            <Bar dataKey="views" name="內容瀏覽" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="logins" name="登入次數" stackId="a" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="quizzes" name="完成測驗" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Learning Curve */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">學習正確率 (%)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                tickFormatter={(val) => val.slice(5)}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />

                            <Line
                                type="monotone"
                                dataKey="accuracy"
                                name="平均正確率"
                                stroke="#10B981"
                                strokeWidth={3}
                                dot={{ r: 4, fill: '#10B981' }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
