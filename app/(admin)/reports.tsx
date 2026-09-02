import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';
import { storage } from '../../src/utils/storage';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const docs = await storage.getDoctors();
      setDocCount(docs.length);
    };
    fetchStats();
  }, []);

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        
        {/* Header */}
        <View className="mb-8">
          <Text style={{ color: colors.darkText }} className="text-2xl font-bold">System Analytics</Text>
          <Text style={{ color: colors.mutedText }} className="text-sm">Monthly performance overview</Text>
        </View>

        {/* Summary Mini Cards */}
        <View className="flex-row justify-between mb-8">
          <SummaryBox label="Consultations" value="156" icon="message-video" />
          <SummaryBox label="Reports Gen" value="89" icon="file-document-outline" />
        </View>

        {/* Visual Analytics Section */}
        <View className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm mb-6">
          <Text className="font-bold text-slate-800 mb-6">Registration Growth</Text>
          
          <View className="items-end flex-row justify-between h-40 px-2">
            <ReportBar height="40%" label="Oct" />
            <ReportBar height="65%" label="Nov" />
            <ReportBar height="85%" label="Dec" active />
            <ReportBar height={`${Math.min(docCount * 5, 100)}%`} label="Jan" />
          </View>
        </View>

        {/* Activity Details List */}
        <Text className="font-bold text-slate-800 mb-4 ml-2">Audit Logs</Text>
        <ReportItem title="Doctor Onboarding" date="Today" status="Completed" />
        <ReportItem title="SOAP Notes Sync" date="Yesterday" status="In Progress" />
        
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Helper Components ---

const SummaryBox = ({ label, value, icon }: any) => (
  <View style={{ width: (screenWidth - 60) / 2 }} className="bg-white p-4 rounded-3xl border border-slate-100 items-center">
    <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
    <Text className="text-xl font-bold mt-1 text-slate-800">{value}</Text>
    <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</Text>
  </View>
);

const ReportBar = ({ height, label, active }: any) => (
  <View className="items-center">
    <View 
      style={{ height, backgroundColor: active ? colors.primary : colors.accent, width: 45 }} 
      className="rounded-xl shadow-sm"
    />
    <Text className="text-[10px] mt-2 text-slate-500 font-medium">{label}</Text>
  </View>
);

const ReportItem = ({ title, date, status }: any) => (
  <View className="bg-white p-4 rounded-2xl mb-3 flex-row justify-between items-center border border-slate-50">
    <View>
      <Text className="font-bold text-slate-700 text-sm">{title}</Text>
      <Text className="text-[10px] text-slate-400">{date}</Text>
    </View>
    <View style={{ backgroundColor: status === 'Completed' ? '#DEF7EC' : '#FEF3C7' }} className="px-3 py-1 rounded-full">
      <Text style={{ color: status === 'Completed' ? '#03543F' : '#92400E' }} className="text-[10px] font-bold">{status}</Text>
    </View>
  </View>
);