import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { BusinessScreen } from '@/screens/business/BusinessScreen';
import { BusinessSettingsScreen } from '@/screens/business/BusinessSettingsScreen';
import { EditBusinessScreen } from '@/screens/business/EditBusinessScreen';
import { InvoiceSettingsScreen } from '@/screens/business/InvoiceSettingsScreen';
import { DigitalCardScreen } from '@/screens/businessCard/DigitalCardScreen';
import { EditBusinessCardScreen } from '@/screens/businessCard/EditBusinessCardScreen';
import { QRCodeScreen } from '@/screens/businessCard/QRCodeScreen';
import { ShareCardScreen } from '@/screens/businessCard/ShareCardScreen';
import { CreateCustomerScreen } from '@/screens/customer/CreateCustomerScreen';
import { CustomerDetailScreen } from '@/screens/customer/CustomerDetailScreen';
import { CustomerHistoryScreen } from '@/screens/customer/CustomerHistoryScreen';
import { CustomerListScreen } from '@/screens/customer/CustomerListScreen';
import { EditCustomerScreen } from '@/screens/customer/EditCustomerScreen';
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

import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="DigitalCard">
      <Stack.Screen
        name="DigitalCard"
        component={DigitalCardScreen}
        options={{ title: 'Business Card' }}
      />
      <Stack.Screen
        name="EditBusinessCard"
        component={EditBusinessCardScreen}
        options={{ title: 'Edit Business Card' }}
      />
      <Stack.Screen name="QRCode" component={QRCodeScreen} options={{ title: 'QR Code' }} />
      <Stack.Screen name="ShareCard" component={ShareCardScreen} options={{ title: 'Share Card' }} />
      <Stack.Screen name="Business" component={BusinessScreen} options={{ title: 'Business' }} />
      <Stack.Screen
        name="EditBusiness"
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
        options={{ title: 'Customer' }}
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
    </Stack.Navigator>
  );
}
