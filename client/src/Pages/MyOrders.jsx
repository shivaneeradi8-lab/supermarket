import { useEffect, useMemo, useState } from 'react';
import * as Ably from 'ably';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import toast from 'react-hot-toast';
import { apiGet, getToken } from '../lib/api';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [28.6139, 77.2090];

const getNumericCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toLatLng = (location) => {
  const latitude = getNumericCoordinate(location?.latitude);
  const longitude = getNumericCoordinate(location?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return [latitude, longitude];
};

const getDestinationLatLng = (order) => {
  const latitude = getNumericCoordinate(order?.shippingAddress?.latitude);
  const longitude = getNumericCoordinate(order?.shippingAddress?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return [latitude, longitude];
};

const FitMapView = ({ courierCenter, destinationCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (courierCenter && destinationCenter) {
      map.fitBounds([courierCenter, destinationCenter], {
        padding: [40, 40],
        maxZoom: 15,
      });
      return;
    }

    if (courierCenter) {
      map.flyTo(courierCenter, Math.max(map.getZoom(), 14), {
        duration: 0.8,
      });
      return;
    }

    if (destinationCenter) {
      map.flyTo(destinationCenter, Math.max(map.getZoom(), 14), {
        duration: 0.8,
      });
    }
  }, [courierCenter, destinationCenter, map]);

  return null;
};

const DeliveryMap = ({ order }) => {
  const courierCenter = toLatLng(order?.deliveryTracking?.currentLocation);
  const destinationCenter = getDestinationLatLng(order);
  const mapCenter = courierCenter || destinationCenter || DEFAULT_CENTER;

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-emerald-200">
      <MapContainer
        center={mapCenter}
        zoom={courierCenter || destinationCenter ? 14 : 5}
        style={{ height: '320px', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapView courierCenter={courierCenter} destinationCenter={destinationCenter} />

        {destinationCenter && (
          <CircleMarker
            center={destinationCenter}
            radius={9}
            pathOptions={{
              color: '#1d4ed8',
              fillColor: '#3b82f6',
              fillOpacity: 0.85,
              weight: 2,
            }}
          />
        )}

        {courierCenter && (
          <CircleMarker
            center={courierCenter}
            radius={10}
            pathOptions={{
              color: '#065f46',
              fillColor: '#10b981',
              fillOpacity: 0.85,
              weight: 2,
            }}
          />
        )}

        {courierCenter && destinationCenter && (
          <Polyline
            positions={[courierCenter, destinationCenter]}
            pathOptions={{
              color: '#0ea5e9',
              weight: 4,
              opacity: 0.8,
              dashArray: '8, 8',
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};

const fmtDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
};

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const latestOrder = useMemo(() => {
    return orders.find((order) => order?.deliveryTracking?.currentLocation) || orders[0] || null;
  }, [orders]);

  useEffect(() => {
    let mounted = true;

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const response = await apiGet('/api/orders?limit=20');
        if (!mounted) return;

        if (!response?.success) {
          toast.error(response?.message || 'Failed to load orders');
          return;
        }

        setOrders(Array.isArray(response.data) ? response.data : []);
      } catch {
        if (mounted) {
          toast.error('Unable to load your orders');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchOrders();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!latestOrder?._id) {
      return undefined;
    }

    const token = getToken();
    if (!token) {
      return undefined;
    }

    const client = new Ably.Realtime({
      authUrl: '/api/realtime/token',
      authMethod: 'POST',
      authHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    const channel = client.channels.get(`order:${latestOrder._id}`);
    const onLocation = (message) => {
      const update = message.data || {};
      setOrders((prev) => prev.map((order) => {
        if (String(order._id) !== String(update.orderId || latestOrder._id)) {
          return order;
        }

        return {
          ...order,
          deliveryTracking: {
            ...(order.deliveryTracking || {}),
            currentLocation: {
              latitude: update.latitude,
              longitude: update.longitude,
              updatedAt: update.updatedAt,
            },
            etaMinutes: update.etaMinutes,
            courierName: update.courierName,
            statusNote: update.statusNote,
          }
        };
      }));
    };

    channel.subscribe('delivery-location-updated', onLocation);

    return () => {
      channel.unsubscribe('delivery-location-updated', onLocation);
      client.close();
    };
  }, [latestOrder?._id]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6 md:px-16 lg:px-24">
      <h1 className="text-3xl font-bold text-gray-800">My Orders</h1>
      <p className="mt-2 text-gray-600">Live delivery location updates stream in automatically.</p>

      {loading ? (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-gray-600">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-gray-600">No orders found yet.</div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-gray-800">Tracked Order</h2>
            <p className="mt-1 text-sm text-gray-500">Order #{String(latestOrder?._id || '').slice(-8).toUpperCase()}</p>

            <div className="mt-5 rounded-xl bg-emerald-50 p-4">
              <p className="text-sm uppercase tracking-wide text-emerald-700">Live Location</p>
              <p className="mt-2 text-lg font-semibold text-emerald-900">
                {latestOrder?.deliveryTracking?.currentLocation
                  ? `${Number(latestOrder.deliveryTracking.currentLocation.latitude).toFixed(5)}, ${Number(latestOrder.deliveryTracking.currentLocation.longitude).toFixed(5)}`
                  : 'Waiting for courier location...'}
              </p>
              <p className="mt-2 text-sm text-emerald-800">Updated: {fmtDate(latestOrder?.deliveryTracking?.currentLocation?.updatedAt)}</p>
            </div>

            <DeliveryMap order={latestOrder} />

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
              <p><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-2" />Courier</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-2" />Destination</p>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
              <p><span className="font-semibold">Courier:</span> {latestOrder?.deliveryTracking?.courierName || 'Assigned soon'}</p>
              <p><span className="font-semibold">ETA:</span> {Number.isFinite(Number(latestOrder?.deliveryTracking?.etaMinutes)) ? `${latestOrder.deliveryTracking.etaMinutes} min` : 'TBD'}</p>
              <p className="md:col-span-2"><span className="font-semibold">Status:</span> {latestOrder?.deliveryTracking?.statusNote || latestOrder?.status || 'Pending'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-800">Recent Orders</h3>
            <div className="mt-4 space-y-3">
              {orders.map((order) => (
                <div key={order._id} className="rounded-xl border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-800">#{String(order._id).slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-gray-500">{fmtDate(order.createdAt)}</p>
                  <p className="mt-1 text-sm text-gray-700">Status: {order.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;