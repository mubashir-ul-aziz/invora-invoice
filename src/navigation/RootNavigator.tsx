import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { AppHeader, HeaderIconButton } from '@/components/shared/AppHeader';
import { BusinessScreen } from '@/screens/business/BusinessScreen';
import { BusinessSettingsScreen } from '@/screens/business/BusinessSettingsScreen';
import { EditBusinessScreen } from '@/screens/business/EditBusinessScreen';
import { InvoiceSettingsScreen } from '@/screens/business/InvoiceSettingsScreen';
import { DigitalCardScreen } from '@/screens/businessCard/DigitalCardScreen';
import { QRCodeScreen } from '@/screens/businessCard/QRCodeScreen';
import { ShareCardScreen } from '@/screens/businessCard/ShareCardScreen';
import { CreateCustomerScreen } from '@/screens/customer/CreateCustomerScreen';
import { CustomerDetailScreen } from '@/screens/customer/CustomerDetailScreen';
import { CustomerHistoryScreen } from '@/screens/customer/CustomerHistoryScreen';
import { CustomerListScreen } from '@/screens/customer/CustomerListScreen';
import { EditCustomerScreen } from '@/screens/customer/EditCustomerScreen';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { CreateInvoiceItemsScreen } from '@/screens/invoice/CreateInvoiceItemsScreen';
import { EditInvoiceScreen } from '@/screens/invoice/EditInvoiceScreen';
import { EditInvoiceLineScreen } from '@/screens/invoice/EditInvoiceLineScreen';
import { InvoiceDetailScreen } from '@/screens/invoice/InvoiceDetailScreen';
import { InvoiceListScreen } from '@/screens/invoice/InvoiceListScreen';
import { InvoiceReviewScreen } from '@/screens/invoice/InvoiceReviewScreen';
import { CustomInvoiceTypeScreen } from '@/screens/invoiceType/CustomInvoiceTypeScreen';
import { InvoiceTypeSelectionScreen } from '@/screens/invoiceType/InvoiceTypeSelectionScreen';
import { CreateItemScreen } from '@/screens/item/CreateItemScreen';
import { EditItemScreen } from '@/screens/item/EditItemScreen';
import { ItemListScreen } from '@/screens/item/ItemListScreen';
import { EditPaymentScreen } from '@/screens/payment/EditPaymentScreen';
import { PaymentHistoryScreen } from '@/screens/payment/PaymentHistoryScreen';
import { RecordPaymentScreen } from '@/screens/payment/RecordPaymentScreen';
import { InvoicePdfPreviewScreen } from '@/screens/pdf/InvoicePdfPreviewScreen';
import { BackupHistoryScreen } from '@/screens/backup/BackupHistoryScreen';
import { BackupScreen } from '@/screens/backup/BackupScreen';
import { CloudBackupHistoryScreen } from '@/screens/cloudBackup/CloudBackupHistoryScreen';
import { CloudBackupScreen } from '@/screens/cloudBackup/CloudBackupScreen';
import { UpgradeStorageScreen } from '@/screens/cloudBackup/UpgradeStorageScreen';
import { AccountScreen } from '@/screens/settings/AccountScreen';
import { InvoiceTemplatesScreen } from '@/screens/settings/InvoiceTemplatesScreen';
import { SecurityScreen } from '@/screens/settings/SecurityScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';

import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{ header: (props) => <AppHeader {...props} /> }}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: 'Dashboard',
          headerRight: () => (
            <HeaderIconButton
              icon="briefcase"
              label="Business"
              testID="header-business"
              onPress={() => navigation.navigate('Business')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="DigitalCard"
        component={DigitalCardScreen}
        options={{ title: 'Business Card' }}
      />
      <Stack.Screen name="QRCode" component={QRCodeScreen} options={{ title: 'QR Code' }} />
      <Stack.Screen name="ShareCard" component={ShareCardScreen} options={{ title: 'Share Card' }} />
      <Stack.Screen name="Business" component={BusinessScreen} options={{ title: 'Business' }} />
      {/*
        `EditBusiness` and `EditBusinessCard` are two entry points into the
        same merged form (business info + digital card info, one Save) — see
        `EditBusinessScreen`'s doc comment. Both routes point at the same
        component rather than collapsing to one route name, so neither the
        Business screen's nor the Digital Card screen's existing
        `navigation.navigate` calls need to change.
      */}
      <Stack.Screen
        name="EditBusiness"
        component={EditBusinessScreen}
        options={{ title: 'Edit Business' }}
      />
      <Stack.Screen
        name="EditBusinessCard"
        component={EditBusinessScreen}
        options={{ title: 'Edit Business' }}
      />
      <Stack.Screen
        name="BusinessSettings"
        component={BusinessSettingsScreen}
        options={{ title: 'Business Settings' }}
      />
      <Stack.Screen
        name="InvoiceSettings"
        component={InvoiceSettingsScreen}
        options={{ title: 'Invoice Settings' }}
      />
      <Stack.Screen
        name="InvoiceTypeSelection"
        component={InvoiceTypeSelectionScreen}
        options={{ title: 'Invoice Type' }}
      />
      <Stack.Screen
        name="CustomInvoiceType"
        component={CustomInvoiceTypeScreen}
        options={{ title: 'Custom Invoice Type' }}
      />
      <Stack.Screen name="ItemList" component={ItemListScreen} options={{ title: 'Items' }} />
      <Stack.Screen
        name="CreateItem"
        component={CreateItemScreen}
        options={{ title: 'New Item' }}
      />
      <Stack.Screen name="EditItem" component={EditItemScreen} options={{ title: 'Edit Item' }} />
      <Stack.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ title: 'Customers' }}
      />
      <Stack.Screen
        name="CreateCustomer"
        component={CreateCustomerScreen}
        options={{ title: 'New Customer' }}
      />
      <Stack.Screen
        name="EditCustomer"
        component={EditCustomerScreen}
        options={{ title: 'Edit Customer' }}
      />
      <Stack.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{ title: 'Customer Detail' }}
      />
      <Stack.Screen
        name="CustomerHistory"
        component={CustomerHistoryScreen}
        options={{ title: 'Customer History' }}
      />
      <Stack.Screen name="InvoiceList" component={InvoiceListScreen} options={{ title: 'Invoices' }} />
      <Stack.Screen
        name="CreateInvoiceItems"
        component={CreateInvoiceItemsScreen}
        options={{ title: 'Invoice Items' }}
      />
      <Stack.Screen
        name="EditInvoiceLine"
        component={EditInvoiceLineScreen}
        options={{ title: 'Line Item' }}
      />
      <Stack.Screen name="InvoiceReview" component={InvoiceReviewScreen} options={{ title: 'Review Invoice' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: 'Invoice' }} />
      <Stack.Screen name="EditInvoice" component={EditInvoiceScreen} options={{ title: 'Edit Invoice' }} />
      <Stack.Screen
        name="RecordPayment"
        component={RecordPaymentScreen}
        options={{ title: 'Record Payment' }}
      />
      <Stack.Screen name="EditPayment" component={EditPaymentScreen} options={{ title: 'Edit Payment' }} />
      <Stack.Screen
        name="PaymentHistory"
        component={PaymentHistoryScreen}
        options={{ title: 'Payments' }}
      />
      <Stack.Screen
        name="InvoicePdfPreview"
        component={InvoicePdfPreviewScreen}
        options={{ title: 'Invoice PDF' }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen
        name="InvoiceTemplates"
        component={InvoiceTemplatesScreen}
        options={{ title: 'Invoice Templates' }}
      />
      <Stack.Screen name="Security" component={SecurityScreen} options={{ title: 'Security' }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Backup & Restore' }} />
      <Stack.Screen
        name="BackupHistory"
        component={BackupHistoryScreen}
        options={{ title: 'Backup History' }}
      />
      <Stack.Screen name="CloudBackup" component={CloudBackupScreen} options={{ title: 'Cloud Backup' }} />
      <Stack.Screen
        name="CloudBackupHistory"
        component={CloudBackupHistoryScreen}
        options={{ title: 'Cloud Backup History' }}
      />
      <Stack.Screen
        name="UpgradeStorage"
        component={UpgradeStorageScreen}
        options={{ title: 'Upgrade Storage' }}
      />
    </Stack.Navigator>
  );
}
